const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials
} = require('discord.js');
const { prisma } = require('../database/prisma');
const { logger } = require('../utils/logger');

class ExtendedClient extends Client {
  constructor(options = {}) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
      ],
      partials: [Partials.Channel],
      allowedMentions: { parse: [] },
      ...options
    });

    this.commands = new Collection();
    this.cooldownCache = new Map(); // cache básico in-memory (por shard/processo)
    this.prisma = prisma;
    this.logger = logger;

    this.services = {};
  }
}

module.exports = { ExtendedClient };

