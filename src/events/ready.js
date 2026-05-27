const { Events } = require('discord.js');
const { env } = require('../config/env');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  async execute(client) {
    client.logger.info({ user: client.user?.tag }, 'Bot ready');

    const platformOwner = env.inviteOwnerIds[0] || 'platform-system';
    await client.services.tenants.bootstrapPlatform(platformOwner);
    client.services.expiration.start();

    client.services.status.start();

    // Garante registro de todos os servidores onde o bot já está (tenant plataforma)
    for (const guild of client.guilds.cache.values()) {
      await client.services.guildSettings.ensure(guild.id, PLATFORM_TENANT_ID);
    }

    try {
      await client.services.analytics.setConnectedGuilds(client.guilds.cache.size);
    } catch (err) {
      client.logger.error({ err }, 'Falha ao atualizar analytics (verifique DATABASE_URL / Supabase)');
    }

    await client.services.logs.write('ready', {
      message: `Bot online como ${client.user?.tag} (${client.guilds.cache.size} servidores)`
    });

    if (client.services.userTokens) {
      client.services.userTokens
        .auditActiveTokens()
        .catch((err) => client.logger.error({ err }, 'Auditoria de tokens falhou'));
    }

    await client.services.tenantCycles.bootstrap();
    client.services.divulgationCycle =
      client.services.tenantCycles.get(PLATFORM_TENANT_ID) ||
      client.services.divulgationCycle;

    client.logger.info('SaaS: tenants, licenças e ciclos multi-tenant inicializados');
  }
};
