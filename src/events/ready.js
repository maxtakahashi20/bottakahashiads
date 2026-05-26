const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  async execute(client) {
    client.logger.info({ user: client.user?.tag }, 'Bot ready');
    client.services.status.start();

    try {
      await client.services.analytics.setConnectedGuilds(client.guilds.cache.size);
    } catch (err) {
      client.logger.error({ err }, 'Falha ao atualizar analytics (verifique DATABASE_URL / Supabase)');
    }

    await client.services.logs.write('ready', {
      message: `Bot online como ${client.user?.tag}`
    });
  }
};

