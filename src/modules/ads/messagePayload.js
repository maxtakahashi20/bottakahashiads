const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { DEFAULT_GLOBAL_MSG } = require('../panel/panelBuilders');

const MAX_CONTENT = 2000;
const MAX_EMBED_DESC = 4096;

/**
 * Payload otimizado para token de usuário (texto simples = mais confiável).
 */
function buildChannelMessagePayload(cfg, guildSettings, { preferContent = true } = {}) {
  const text = (guildSettings?.customMessage || cfg.globalMessage || DEFAULT_GLOBAL_MSG).trim();
  const safeText = text.slice(0, preferContent ? MAX_CONTENT : MAX_EMBED_DESC);

  if (preferContent) {
    const payload = { content: safeText || 'Divulgação — Takahashi Network' };
    if (cfg.globalInviteUrl && safeText.length < MAX_CONTENT - 50) {
      payload.content = `${safeText}\n\n${cfg.globalInviteUrl}`.slice(0, MAX_CONTENT);
    }
    return payload;
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setDescription(safeText.slice(0, MAX_EMBED_DESC))
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  if (cfg.globalBannerUrl) embed.setImage(cfg.globalBannerUrl);

  const payload = { embeds: [embed] };
  if (cfg.globalInviteUrl) payload.content = cfg.globalInviteUrl.slice(0, MAX_CONTENT);
  return payload;
}

module.exports = { buildChannelMessagePayload, MAX_CONTENT };
