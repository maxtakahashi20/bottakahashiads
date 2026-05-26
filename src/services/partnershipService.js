class PartnershipService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Servidores ativos na rede (anúncios vão por DM aos membros de cada um).
   */
  async listNetworkTargets({ excludeGuildId } = {}) {
    const rows = await this.client.prisma.guildSettings.findMany({
      where: {
        adsEnabled: true,
        guildId: excludeGuildId ? { not: excludeGuildId } : undefined
      },
      select: { guildId: true }
    });
    return rows;
  }
}

module.exports = { PartnershipService };
