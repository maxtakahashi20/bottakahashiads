class PartnershipService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Parceiros = servidores onde o bot está (exceto quem está anunciando).
   * Servidor com /setup-ads → Desativar rede não recebe mais.
   */
  async listNetworkTargets({ excludeGuildId } = {}) {
    const targets = [];

    for (const guild of this.client.guilds.cache.values()) {
      if (excludeGuildId && guild.id === excludeGuildId) continue;

      const settings = await this.client.services.guildSettings.get(guild.id);
      if (settings?.adsEnabled === false) continue;

      targets.push({
        guildId: guild.id,
        guildName: guild.name
      });
    }

    return targets;
  }

  getBotGuildCount() {
    return this.client.guilds.cache.size;
  }
}

module.exports = { PartnershipService };
