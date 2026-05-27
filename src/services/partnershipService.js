const { DIVULGATION } = require('../config/constants');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

class PartnershipService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Todos os parceiros com canal configurado (bot pode não estar no servidor).
   * @param {{ excludeGuildId?: string, tenantId?: string }} opts
   */
  async listNetworkTargets({ excludeGuildId, tenantId = PLATFORM_TENANT_ID } = {}) {
    const rows = await this.client.prisma.guildSettings.findMany({
      where: {
        tenantId,
        adsChannelId: { not: null },
        adsEnabled: { not: false }
      }
    });

    const targets = [];
    for (const s of rows) {
      if (excludeGuildId && s.guildId === excludeGuildId) continue;

      const cached = this.client.guilds.cache.get(s.guildId);
      targets.push({
        guildId: s.guildId,
        guildName: cached?.name || s.partnerGuildName || `Servidor ${s.guildId}`,
        channelId: s.adsChannelId,
        delayMinutes: s.delayMinutes || DIVULGATION.minIntervalMinutes
      });
    }
    return targets;
  }

  async countConfigured(tenantId = PLATFORM_TENANT_ID) {
    return this.client.prisma.guildSettings.count({
      where: {
        tenantId,
        adsChannelId: { not: null },
        adsEnabled: { not: false }
      }
    });
  }

  getBotGuildCount() {
    return this.client.guilds.cache.size;
  }
}

module.exports = { PartnershipService };
