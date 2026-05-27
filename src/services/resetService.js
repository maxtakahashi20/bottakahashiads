const { prisma } = require('../database/prisma');
const { PLATFORM_TENANT_ID } = require('../config/licensing');
const { DEFAULT_SETTINGS } = require('../modules/tenants/tenantProvisioner');
const { invalidatePanelCaches } = require('../modules/panel/panelCache');
const { invalidateDivulgationCache } = require('../modules/panel/panelStats');
const { isMissingTableError } = require('../utils/prismaSafe');

/**
 * Resets administrativos por tenant (Discord bot).
 */
class ResetService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async resetGuilds(tenantId) {
    const stats = { servidores: 0, parcerias: 0 };

    try {
      const parts = await prisma.partnership.deleteMany({ where: { tenantId } });
      stats.parcerias = parts.count;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      const guilds = await prisma.guildSettings.deleteMany({ where: { tenantId } });
      stats.servidores = guilds.count;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    this._invalidateRuntime(tenantId);

    return {
      ok: true,
      message: 'Servidores e parcerias removidos. Configure novamente em `/painel` → **Servidores**.',
      stats
    };
  }

  async resetToken(tenantId) {
    let removed = 0;
    if (this.client.services.userTokens?.removeAllForTenant) {
      removed = await this.client.services.userTokens.removeAllForTenant(tenantId);
    } else {
      const r = await prisma.userToken.deleteMany({ where: { tenantId } });
      removed = r.count;
    }

    this._invalidateRuntime(tenantId);

    return {
      ok: true,
      message:
        removed > 0
          ? `**${removed}** token(s) removido(s). Adicione um novo em \`/painel\` → **Tokens**.`
          : 'Nenhum token estava salvo. Você já pode cadastrar um novo token.',
      stats: { tokens: removed }
    };
  }

  async resetAll(tenantId) {
    const stats = {};

    this.client.services.tenantCycles?.stopForTenant(tenantId);
    if (tenantId === PLATFORM_TENANT_ID) {
      this.client.services.adsQueue?.clearQueue();
    }

    const guilds = await this.resetGuilds(tenantId);
    const tokens = await this.resetToken(tenantId);
    Object.assign(stats, guilds.stats, tokens.stats);

    try {
      await prisma.tenantSettings.update({
        where: { tenantId },
        data: {
          ...DEFAULT_SETTINGS,
          botRunning: false,
          globalMessage: null,
          globalBannerUrl: null,
          globalInviteUrl: null,
          scheduledAt: null,
          lastSendAt: null,
          totalCycles: 0,
          configVersion: { increment: 1 }
        }
      });
      stats.config = 1;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      await prisma.tenantBranding.deleteMany({ where: { tenantId } });
      await prisma.tenantEmbedTemplate.deleteMany({ where: { tenantId } });
    } catch {
      /* tabelas opcionais */
    }

    try {
      const runs = await prisma.divulgationRun.deleteMany({ where: { tenantId } });
      stats.divulgacoes = runs.count;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      const ads = await prisma.advertisement.deleteMany({ where: { tenantId } });
      stats.anuncios = ads.count;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      await prisma.analytics.upsert({
        where: { tenantId },
        create: {
          tenantId,
          totalAds: 0,
          totalDeliveries: 0,
          totalFailures: 0,
          connectedGuilds: 0,
          networkEnabled: true
        },
        update: {
          totalAds: 0,
          totalDeliveries: 0,
          totalFailures: 0,
          connectedGuilds: 0
        }
      });
      stats.analytics = 1;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      const cd = await prisma.cooldown.deleteMany({ where: { tenantId } });
      stats.cooldowns = cd.count;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      const bl = await prisma.blacklist.deleteMany({ where: { tenantId } });
      stats.blacklist = bl.count;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    try {
      const ws = await prisma.webSession.deleteMany({ where: { tenantId } });
      stats.sessoes = ws.count;
    } catch {
      /* opcional */
    }

    this.client.services.tenantConfig?.invalidate(tenantId);
    this._invalidateRuntime(tenantId);
    invalidateDivulgationCache();

    return {
      ok: true,
      message:
        'Ambiente **resetado por completo**. Licença mantida — use `/painel` para reconfigurar tokens, servidores e mensagens.',
      stats
    };
  }

  _invalidateRuntime(tenantId) {
    invalidatePanelCaches(this.client);
    this.client.services.tenantConfig?.invalidate(tenantId);

    const tokens = this.client.services.userTokens;
    if (tokens) {
      tokens._invalidate?.();
      tokens._blockedChannels?.clear?.();
      tokens._rateLimitedUntil?.clear?.();
      tokens._lastSendError = null;
    }
  }
}

module.exports = { ResetService };
