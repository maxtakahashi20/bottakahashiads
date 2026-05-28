const { Events } = require('discord.js');
const { PLATFORM_TENANT_ID } = require('../config/licensing');
const { dbErrorMessage } = require('../utils/prismaSafe');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  async execute(client) {
    client.logger.info({ user: client.user?.tag }, 'Bot ready');

    try {
      await client.services.tenants.bootstrapPlatform();
    } catch (err) {
      client.logger.error({ err }, `SaaS bootstrap: ${dbErrorMessage(err)}`);
    }

    try {
      client.services.expiration.start();
    } catch (err) {
      client.logger.error({ err }, 'Expiration service falhou');
    }

    client.services.status.start();

    for (const guild of client.guilds.cache.values()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await client.services.guildSettings.ensure(guild.id, PLATFORM_TENANT_ID);
      } catch (err) {
        client.logger.warn({ err, guildId: guild.id }, 'guildSettings.ensure falhou');
      }
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

    try {
      await client.services.tenantCycles.bootstrap();
      client.services.divulgationCycle =
        client.services.tenantCycles.get(PLATFORM_TENANT_ID) ||
        client.services.divulgationCycle;
    } catch (err) {
      client.logger.error({ err }, 'Ciclos multi-tenant falharam ao iniciar');
      const cfg = await client.services.tenantConfig?.get(PLATFORM_TENANT_ID).catch(() => null);
      if (cfg?.botRunning !== false && client.services.divulgationCycle?.start) {
        client.services.divulgationCycle.start();
      }
    }

    client.logger.info('SaaS: tenants, licenças e ciclos multi-tenant inicializados');

    if (client.services.webSync) {
      client.services.webSync.start();
      client.logger.info('Painel web: sync de branding/embed ativo (60s)');
    }
  }
};
