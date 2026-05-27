const dotenv = require('dotenv');

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  /** Se definido, registra comandos só neste servidor (instantâneo) */
  devGuildId: process.env.DISCORD_DEV_GUILD_ID || null,
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT || 3000),
  apiKey: process.env.API_KEY_CHANGE_ME || 'change-me',
  logWebhookUrl: process.env.LOG_WEBHOOK_URL || null,
  /** URL pública da API (link bonito: /invite/takahashi-store) */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(
    /\/$/,
    ''
  ),
  /** IDs Discord que podem usar /invite (vazio = só Administrador no servidor) */
  inviteOwnerIds: (process.env.BOT_OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};

module.exports = { env };

