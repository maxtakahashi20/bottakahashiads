const { prisma } = require('../database/prisma');
const { PLATFORM_TENANT_ID } = require('../config/licensing');
const { provisionTenant, ensurePlatformTenant } = require('../modules/tenants/tenantProvisioner');
const { isMissingTableError } = require('../utils/prismaSafe');

class TenantService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.platformTenantId = PLATFORM_TENANT_ID;
  }

  async bootstrapPlatform() {
    return ensurePlatformTenant(prisma);
  }

  async getByOwner(userId) {
    try {
      return await prisma.tenant.findUnique({
        where: { ownerUserId: userId },
        include: {
          settings: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { endsAt: 'desc' },
            take: 1
          }
        }
      });
    } catch (err) {
      if (isMissingTableError(err)) return null;
      throw err;
    }
  }

  async getById(tenantId) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });
  }

  async createForOwner(ownerUserId, displayName) {
    const existing = await this.getByOwner(ownerUserId);
    if (existing?.isPlatform) {
      throw new Error('Conta vinculada ao ambiente plataforma. Use outra conta Discord para ativar licença.');
    }
    if (existing) {
      throw new Error('Este usuário já possui um ambiente. Use `/renovar` com uma licença nova.');
    }
    return provisionTenant(prisma, { ownerUserId, displayName });
  }

  async setStatus(tenantId, status) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status }
    });
    await prisma.tenantSettings.updateMany({
      where: { tenantId },
      data: {
        botRunning: status === 'ACTIVE',
        networkEnabled: status === 'ACTIVE'
      }
    });
    this.client.services.tenantConfig?.invalidate(tenantId);
    return tenant;
  }

  async listActiveClients() {
    return prisma.tenant.findMany({
      where: { isPlatform: false, status: 'ACTIVE' },
      include: { settings: true }
    });
  }

  isPlatformTenant(tenantId) {
    return tenantId === this.platformTenantId;
  }
}

module.exports = { TenantService };
