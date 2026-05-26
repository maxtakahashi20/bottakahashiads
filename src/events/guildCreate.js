module.exports = {
  name: 'guildCreate',
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').Guild} guild
   */
  async execute(client, guild) {
    await client.services.guildSettings.ensure(guild.id);
    await client.services.analytics.setConnectedGuilds(client.guilds.cache.size);
    await client.services.logs.write('guild_added', {
      guildId: guild.id,
      message: `Servidor adicionado: ${guild.name}`,
      meta: { guildName: guild.name, memberCount: guild.memberCount }
    });
  }
};
