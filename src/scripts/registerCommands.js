const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

function walkJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...walkJsFiles(p));
    else if (it.isFile() && it.name.endsWith('.js')) out.push(p);
  }
  return out;
}

async function main() {
  const commandsDir = path.join(process.cwd(), 'src', 'commands');
  const files = walkJsFiles(commandsDir);

  const commands = [];
  for (const f of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const cmd = require(f);
    if (!cmd?.data?.toJSON) continue;
    commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(env.discordToken);

  if (env.devGuildId) {
    logger.info({ count: commands.length, guild: env.devGuildId }, 'Registering guild commands');
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.devGuildId), {
      body: commands
    });
  } else {
    logger.info({ count: commands.length }, 'Registering global commands');
    await rest.put(Routes.applicationCommands(env.discordClientId), { body: commands });
  }

  logger.info('Commands registered');
}

main().catch((err) => {
  logger.error({ err }, 'Failed to register commands');
  process.exitCode = 1;
});

