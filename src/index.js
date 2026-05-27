const express = require('express');
const { env } = require('./config/env');
const { ExtendedClient } = require('./structures/ExtendedClient');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const { LogService } = require('./services/logService');
const { AnalyticsService } = require('./services/analyticsService');
const { GuildSettingsService } = require('./services/guildSettingsService');
const { AntiSpamService } = require('./services/antiSpamService');
const { BlacklistService } = require('./services/blacklistService');
const { PremiumService } = require('./services/premiumService');
const { PartnershipService } = require('./services/partnershipService');
const { StatusService } = require('./services/statusService');
const { AdQueueService } = require('./modules/ads/adQueueService');
const { NetworkService } = require('./services/networkService');
const { DivulgationCycleService } = require('./services/divulgationCycleService');
const { UserTokenService } = require('./services/userTokenService');
const { createInviteRouter } = require('./api/inviteRoutes');

const { logger } = require('./utils/logger');

function bootApi(client) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      bot: client.user?.tag || null,
      guilds: client.guilds.cache.size,
      uptimeSec: Math.floor(process.uptime())
    });
  });

  // base para painel/API futura (protegida por API key simples)
  app.get('/api/stats', (req, res) => {
    if (req.header('x-api-key') !== env.apiKey) return res.status(401).json({ ok: false });
    res.json({
      ok: true,
      guilds: client.guilds.cache.size
    });
  });

  app.use(createInviteRouter(client));

  app.listen(env.port, () =>
    logger.info({ port: env.port, publicBaseUrl: env.publicBaseUrl }, 'API listening')
  );
}

async function main() {
  const client = new ExtendedClient();

  client.services.logs = new LogService(client);
  client.services.analytics = new AnalyticsService(client);
  client.services.guildSettings = new GuildSettingsService(client);
  client.services.blacklist = new BlacklistService(client);
  client.services.antiSpam = new AntiSpamService(client);
  client.services.premium = new PremiumService(client);
  client.services.partnerships = new PartnershipService(client);
  client.services.adsQueue = new AdQueueService(client);
  client.services.network = new NetworkService(client);
  client.services.status = new StatusService(client);
  client.services.divulgationCycle = new DivulgationCycleService(client);
  client.services.userTokens = new UserTokenService(client);
  client.panelStatsCache = { data: null, at: 0 };

  loadCommands(client);
  loadEvents(client);

  bootApi(client);

  process.on('unhandledRejection', (reason) => {
    client.logger.error({ reason }, 'UnhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    client.logger.error({ err }, 'UncaughtException');
  });

  await client.login(env.discordToken);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exitCode = 1;
});

