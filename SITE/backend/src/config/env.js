const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const clientId = required('DISCORD_CLIENT_ID');
const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';

if (clientSecret && clientSecret === clientId) {
  throw new Error(
    'DISCORD_CLIENT_SECRET não pode ser igual ao DISCORD_CLIENT_ID. ' +
      'No Developer Portal: OAuth2 → Copiar Client Secret (não é o ID numérico).'
  );
}
if (clientSecret && /^\d{17,20}$/.test(clientSecret.trim())) {
  throw new Error(
    'DISCORD_CLIENT_SECRET parece um Client ID. Use o secret alfanumérico do Portal (OAuth2 → Reset Secret).'
  );
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.WEB_API_PORT || 3001),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: process.env.JWT_SECRET || process.env.API_KEY_CHANGE_ME || 'change-me-jwt-secret-min-32-chars!!',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  discordClientId: clientId.trim(),
  discordClientSecret: clientSecret.trim(),
  discordRedirectUri:
    process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  webUrl: (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, ''),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  internalApiKey: process.env.INTERNAL_API_KEY || process.env.API_KEY_CHANGE_ME || 'change-me',
  platformOwnerIds: (process.env.BOT_OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};

module.exports = { env };
