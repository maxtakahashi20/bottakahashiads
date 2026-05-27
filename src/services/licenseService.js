const { prisma } = require('../database/prisma');
const { generateLicenseCode } = require('../modules/licenses/licenseCode');
const { validateLicenseFormat } = require('../modules/licenses/licenseValidators');
const { DURATION_LABELS } = require('../config/licensing');

const MAX_GEN_ATTEMPTS = 8;

class LicenseService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async generate({ duration, createdByUserId, note = null }) {
    let code = null;
    for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
      const candidate = generateLicenseCode();
      // eslint-disable-next-line no-await-in-loop
      const exists = await prisma.license.findUnique({ where: { code: candidate } });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error('Não foi possível gerar código único. Tente novamente.');

    const license = await prisma.license.create({
      data: {
        code,
        duration,
        status: 'PENDING',
        createdByUserId,
        note
      }
    });

    await this.client.services.audit.write('license.created', {
      actorId: createdByUserId,
      target: code,
      message: `Licença ${DURATION_LABELS[duration]}`,
      meta: { duration, licenseId: license.id }
    });

    return license;
  }

  async findByCode(rawCode) {
    const v = validateLicenseFormat(rawCode);
    if (!v.ok) return { ok: false, error: v.error, license: null };
    const license = await prisma.license.findUnique({ where: { code: v.code } });
    if (!license) return { ok: false, error: 'Licença não encontrada.', license: null };
    return { ok: true, license, code: v.code };
  }

  async activate({ code, userId, displayName }) {
    const found = await this.findByCode(code);
    if (!found.ok) return { ok: false, error: found.error };

    const license = found.license;
    if (license.status === 'REVOKED') {
      return { ok: false, error: 'Esta licença foi revogada.' };
    }
    if (license.status === 'ACTIVATED') {
      return { ok: false, error: 'Esta licença já foi utilizada.' };
    }
    if (license.status === 'EXPIRED') {
      return { ok: false, error: 'Esta licença expirou.' };
    }

    const existingTenant = await this.client.services.tenants.getByOwner(userId);
    if (existingTenant && !existingTenant.isPlatform) {
      return {
        ok: false,
        error: 'Você já possui um ambiente. Use `/renovar` ou contate o suporte.'
      };
    }

    const tenant = await this.client.services.tenants.createForOwner(
      userId,
      displayName || `Takahashi — ${userId}`
    );

    const subscription = await this.client.services.subscriptions.createFromLicense({
      tenantId: tenant.id,
      licenseId: license.id,
      duration: license.duration
    });

    await prisma.license.update({
      where: { id: license.id },
      data: {
        status: 'ACTIVATED',
        activatedAt: new Date(),
        activatedByUserId: userId,
        tenantId: tenant.id
      }
    });

    await this.client.services.audit.write('license.activated', {
      tenantId: tenant.id,
      actorId: userId,
      target: license.code,
      meta: { subscriptionId: subscription.id, endsAt: subscription.endsAt }
    });

    await this.client.services.tenantCycles?.startForTenant(tenant.id);

    return {
      ok: true,
      tenant,
      subscription,
      license,
      endsAt: subscription.endsAt
    };
  }

  async revoke({ code, revokedByUserId, reason }) {
    const found = await this.findByCode(code);
    if (!found.ok) return { ok: false, error: found.error };

    const license = await prisma.license.update({
      where: { id: found.license.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedByUserId,
        note: reason || found.license.note
      }
    });

    if (license.tenantId) {
      await this.client.services.tenants.setStatus(license.tenantId, 'SUSPENDED');
      this.client.services.tenantCycles?.stopForTenant(license.tenantId);
    }

    await this.client.services.audit.write('license.revoked', {
      tenantId: license.tenantId,
      actorId: revokedByUserId,
      target: license.code,
      message: reason
    });

    return { ok: true, license };
  }

  async listRecent(limit = 15) {
    return prisma.license.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { tenant: { select: { ownerUserId: true, displayName: true } } }
    });
  }

  async renewWithLicense({ code, userId }) {
    const found = await this.findByCode(code);
    if (!found.ok) return { ok: false, error: found.error };
    if (found.license.status !== 'PENDING') {
      return { ok: false, error: 'Use uma licença nova (ainda não ativada) para renovar.' };
    }

    const tenant = await this.client.services.tenants.getByOwner(userId);
    if (!tenant || tenant.isPlatform) {
      return { ok: false, error: 'Você não possui ambiente ativo. Use `/ativar` primeiro.' };
    }

    const extraDays = this.client.services.subscriptions.durationToDays(found.license.duration);
    const subscription = await this.client.services.subscriptions.extendActive(tenant.id, extraDays);

    await prisma.license.update({
      where: { id: found.license.id },
      data: {
        status: 'ACTIVATED',
        activatedAt: new Date(),
        activatedByUserId: userId,
        tenantId: tenant.id
      }
    });

    if (tenant.status !== 'ACTIVE') {
      await this.client.services.tenants.setStatus(tenant.id, 'ACTIVE');
      this.client.services.tenantCycles?.startForTenant(tenant.id);
    }

    await this.client.services.audit.write('license.renewed', {
      tenantId: tenant.id,
      actorId: userId,
      target: found.license.code,
      meta: { endsAt: subscription.endsAt }
    });

    return { ok: true, subscription, endsAt: subscription.endsAt };
  }
}

module.exports = { LicenseService };
