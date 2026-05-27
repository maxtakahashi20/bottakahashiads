const fs = require('fs');
const path = require('path');
const { REST, Routes, Client, GatewayIntentBits } = require('discord.js');
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

function loadCommands() {
  const commandsDir = path.join(process.cwd(), 'src', 'commands');
  const files = walkJsFiles(commandsDir);
  const commands = [];
  const names = [];

  for (const f of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const cmd = require(f);
    if (!cmd?.data?.toJSON) continue;
    commands.push(cmd.data.toJSON());
    names.push(cmd.data.name);
  }

  return { commands, names };
}

async function fetchBotGuildIds() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(env.discordToken);
  const guilds = [...client.guilds.cache.values()].map((g) => ({
    id: g.id,
    name: g.name
  }));
  await client.destroy();
  return guilds;
}

async function main() {
  const { commands, names } = loadCommands();
  const rest = new REST({ version: '10' }).setToken(env.discordToken);

  logger.info({ count: commands.length, commands: names }, 'Comandos carregados');

  if (env.devGuildId) {
    logger.info({ guild: env.devGuildId }, 'Registrando no servidor (DISCORD_DEV_GUILD_ID)');
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.devGuildId), {
      body: commands
    });
    logger.info('Comandos registrados no servidor — aparecem em segundos');
    return;
  }

  const guilds = await fetchBotGuildIds();
  if (!guilds.length) {
    logger.warn('Bot em nenhum servidor — registrando globalmente (pode demorar até 1h)');
    await rest.put(Routes.applicationCommands(env.discordClientId), { body: commands });
    return;
  }

  for (const guild of guilds) {
    logger.info({ guildId: guild.id, guildName: guild.name }, 'Registrando comandos no servidor');
    // eslint-disable-next-line no-await-in-loop
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, guild.id), {
      body: commands
    });
  }

  if (process.env.REGISTER_GLOBAL === 'true') {
    logger.info('Registrando também comandos globais');
    await rest.put(Routes.applicationCommands(env.discordClientId), { body: commands });
  }

  logger.info(
    { guilds: guilds.map((g) => g.name) },
    'Pronto! Use /painel e /setup-ads — filtre pelo bot Takahashi Ads'
  );
}

main().catch((err) => {
  logger.error({ err }, 'Failed to register commands');
  process.exitCode = 1;
});
