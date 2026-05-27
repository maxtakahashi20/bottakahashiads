const { DIVULGATION } = require('../config/constants');

class PartnershipService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Todos os parceiros com canal configurado (bot pode não estar no servidor).
   */
  async listNetworkTargets({ excludeGuildId } = {}) {
    const rows = await this.client.prisma.guildSettings.findMany({
      where: {
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

  async countConfigured() {
    return this.client.prisma.guildSettings.count({
      where: {
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
