const { ActivityType } = require('discord.js');
const { prisma } = require('../database/prisma');

const SYNC_MS = 60_000;
const cache = new Map();

/**
 * Aplica branding e embed do painel web ao bot (por tenant).
 */
class TenantWebSyncService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.timer = null;
  }

  start() {
    this.stop();
    this._tick().catch((err) => this.client.logger.error({ err }, 'Web sync tick failed'));
    this.timer = setInterval(() => {
      this._tick().catch((err) => this.client.logger.error({ err }, 'Web sync tick failed'));
    }, SYNC_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async _tick() {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE', isPlatform: false },
      select: { id: true }
    });

    for (const t of tenants) {
      // eslint-disable-next-line no-await-in-loop
      await this.syncTenant(t.id).catch(() => {});
    }

    await this.syncTenant('platform').catch(() => {});
  }

  async syncTenant(tenantId) {
    const [branding, settings] = await Promise.all([
      prisma.tenantBranding.findUnique({ where: { tenantId } }),
      prisma.tenantSettings.findUnique({ where: { tenantId } })
    ]);

    if (!branding && !settings) return;

    const key = tenantId;
    const version = settings?.configVersion ?? 0;
    const hit = cache.get(key);
    if (hit && hit.version === version && hit.brandingId === branding?.updatedAt?.getTime()) {
      return;
    }

    if (branding?.botDisplayName && tenantId === 'platform') {
      try {
        await this.client.user.setUsername(branding.botDisplayName.slice(0, 32));
      } catch {
        /* rate limit global username */
      }
    }

    if (branding?.botAvatarUrl) {
      try {
        await this.client.user.setAvatar(branding.botAvatarUrl);
      } catch {
        /* invalid url or rate limit */
      }
    }

    if (branding?.botStatusText) {
      const typeMap = {
        online: ActivityType.Playing,
        idle: ActivityType.Idle,
        dnd: ActivityType.DoNotDisturb,
        invisible: ActivityType.Playing
      };
      const status = branding.botStatusType === 'invisible' ? 'invisible' : 'online';
      await this.client.user.setPresence({
        activities: [
          {
            name: branding.botStatusText.slice(0, 128),
            type: typeMap[branding.botStatusType] || ActivityType.Playing
          }
        ],
        status
      });
    }

    cache.set(key, {
      version,
      brandingId: branding?.updatedAt?.getTime() ?? 0
    });

    if (this.client.services.tenantConfig?.invalidate) {
      this.client.services.tenantConfig.invalidate(tenantId);
    }
  }

  /**
   * Cache de embed por tenant para messagePayload.
   */
  async getEmbedTemplate(tenantId) {
    return prisma.tenantEmbedTemplate.findUnique({ where: { tenantId } });
  }
}

module.exports = { TenantWebSyncService };
