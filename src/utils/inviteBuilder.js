const { PermissionFlagsBits } = require('discord.js');
const { env } = require('../config/env');

/** Permissões necessárias para ads, setup e DMs */
const BOT_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.ManageGuild;

const SCOPES = ['bot', 'applications.commands'].join(' ');

/**
 * @param {string} [slug]
 */
function normalizeSlug(slug) {
  const raw = String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return raw.slice(0, 48);
}

/**
 * Link oficial Discord para adicionar o bot a um servidor.
 * @param {string} [slug] — gravado em state (rastreio quando suportado)
 */
function buildDiscordBotInviteUrl(slug) {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    permissions: String(BOT_PERMISSIONS),
    scope: SCOPES,
    response_type: 'code'
  });
  if (slug) params.set('state', slug);
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Link “da loja” na sua API — ao abrir no navegador, redireciona pro Discord.
 * Ex: https://seu-dominio.com/invite/takahashi-store
 */
function buildBrandedInviteUrl(slug) {
  const s = normalizeSlug(slug);
  if (!s) return null;
  return `${env.publicBaseUrl}/invite/${encodeURIComponent(s)}`;
}

module.exports = {
  BOT_PERMISSIONS,
  normalizeSlug,
  buildDiscordBotInviteUrl,
  buildBrandedInviteUrl
};
