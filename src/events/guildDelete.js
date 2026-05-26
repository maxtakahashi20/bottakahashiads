module.exports = {
  name: 'guildDelete',
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').Guild} guild
   */
  async execute(client, guild) {
    await client.services.analytics.setConnectedGuilds(client.guilds.cache.size);
    await client.services.logs.write('guild_removed', {
      guildId: guild.id,
      message: `Servidor removido: ${guild.name}`,
      meta: { guildName: guild.name }
    });
  }
};

