const { AdCategory } = require('@prisma/client');
const { PLATFORM_TENANT_ID } = require('../config/licensing');
const { isSchemaMismatchError } = require('../utils/prismaSafe');

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

  async _findLegacy(guildId, tenantId) {
    return this.client.prisma.guildSettings.findFirst({
      where: { guildId, tenantId: tenantId || PLATFORM_TENANT_ID }
    });
  }

  async ensure(guildId, tenantId = PLATFORM_TENANT_ID) {
    const tid = tenantId || PLATFORM_TENANT_ID;
    try {
      return await this.client.prisma.guildSettings.upsert({
        where: this._key(tid, guildId),
        create: { tenantId: tid, guildId, adsEnabled: true, allowedCategories: [] },
        update: {}
      });
    } catch (err) {
      if (!isSchemaMismatchError(err)) throw err;
      const existing = await this._findLegacy(guildId, tid);
      if (existing) return existing;
      return this.client.prisma.guildSettings.create({
        data: { tenantId: tid, guildId, adsEnabled: true, allowedCategories: [] }
      });
    }
  }

  async get(guildId, tenantId = PLATFORM_TENANT_ID) {
    const tid = tenantId || PLATFORM_TENANT_ID;
    try {
      return await this.client.prisma.guildSettings.findUnique({
        where: this._key(tid, guildId)
      });
    } catch (err) {
      if (!isSchemaMismatchError(err)) throw err;
      return this._findLegacy(guildId, tid);
    }
  }

  async update(guildId, patch, tenantId = PLATFORM_TENANT_ID) {
    const tid = tenantId || PLATFORM_TENANT_ID;
    await this.ensure(guildId, tid);
    try {
      return await this.client.prisma.guildSettings.update({
        where: this._key(tid, guildId),
        data: patch
      });
    } catch (err) {
      if (!isSchemaMismatchError(err)) throw err;
      const row = await this._findLegacy(guildId, tid);
      if (!row) throw err;
      return this.client.prisma.guildSettings.update({
        where: { id: row.id },
        data: patch
      });
    }
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
