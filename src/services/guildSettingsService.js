const { AdCategory } = require('@prisma/client');

class GuildSettingsService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async ensure(guildId) {
    return this.client.prisma.guildSettings.upsert({
      where: { guildId },
      create: { guildId, adsEnabled: false, allowedCategories: [] },
      update: {}
    });
  }

  async get(guildId) {
    return this.client.prisma.guildSettings.findUnique({ where: { guildId } });
  }

  async update(guildId, patch) {
    await this.ensure(guildId);
    return this.client.prisma.guildSettings.update({
      where: { guildId },
      data: patch
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

