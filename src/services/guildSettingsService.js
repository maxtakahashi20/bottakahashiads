const { AdCategory } = require('@prisma/client');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

class GuildSettingsService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  _key(tenantId, guildId) {
    return { tenantId_guildId: { tenantId: tenantId || PLATFORM_TENANT_ID, guildId } };
  }

  async ensure(guildId, tenantId = PLATFORM_TENANT_ID) {
    const tid = tenantId || PLATFORM_TENANT_ID;
    return this.client.prisma.guildSettings.upsert({
      where: this._key(tid, guildId),
      create: { tenantId: tid, guildId, adsEnabled: true, allowedCategories: [] },
      update: {}
    });
  }

  async get(guildId, tenantId = PLATFORM_TENANT_ID) {
    return this.client.prisma.guildSettings.findUnique({
      where: this._key(tenantId, guildId)
    });
  }

  async update(guildId, patch, tenantId = PLATFORM_TENANT_ID) {
    await this.ensure(guildId, tenantId);
    return this.client.prisma.guildSettings.update({
      where: this._key(tenantId, guildId),
      data: patch
    });
  }

  async countForTenant(tenantId) {
    return this.client.prisma.guildSettings.count({
      where: {
        tenantId,
        adsChannelId: { not: null },
        adsEnabled: { not: false }
      }
    });
  }

  normalizeCategories(input) {
    const allowed = new Set(Object.values(AdCategory));
    const arr = Array.isArray(input) ? input : [];
    return arr
      .map((s) => String(s || '').toUpperCase().trim())
      .filter((s) => allowed.has(s));
  }
}

module.exports = { GuildSettingsService };

