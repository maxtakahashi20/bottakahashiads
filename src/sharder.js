const { ShardingManager } = require('discord.js');
const { env } = require('./config/env');
const { logger } = require('./utils/logger');

// Use este entrypoint quando for escalar em produção.
// Ex: node src/sharder.js

const manager = new ShardingManager('./src/index.js', {
  token: env.discordToken,
  totalShards: 'auto',
  respawn: true
});

manager.on('shardCreate', (shard) => {
  logger.info({ shard: shard.id }, 'Shard launched');
});

manager.spawn().catch((err) => {
  logger.error({ err }, 'Failed to spawn shards');
  process.exitCode = 1;
});

