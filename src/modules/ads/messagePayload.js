const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { DEFAULT_GLOBAL_MSG } = require('../panel/panelBuilders');

const MAX_CONTENT = 2000;
const MAX_EMBED_DESC = 4096;

/**
 * Payload otimizado para token de usuário (texto simples = mais confiável).
 * @param {object} [embedTemplate] — TenantEmbedTemplate do painel web
 */
function buildChannelMessagePayload(cfg, guildSettings, { preferContent = true, embedTemplate = null } = {}) {
  const text = (guildSettings?.customMessage || cfg.globalMessage || DEFAULT_GLOBAL_MSG).trim();
  const safeText = text.slice(0, preferContent ? MAX_CONTENT : MAX_EMBED_DESC);

  const useEmbed =
    embedTemplate?.useEmbedMode ||
    Boolean(embedTemplate?.title || embedTemplate?.description || embedTemplate?.bannerUrl);

  if (useEmbed && embedTemplate) {
    const color = embedTemplate.color ?? BRAND.color;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTimestamp();

    if (embedTemplate.title) embed.setTitle(embedTemplate.title.slice(0, 256));
    embed.setDescription(
      (embedTemplate.description || safeText || 'Divulgação — Takahashi Network').slice(0, MAX_EMBED_DESC)
    );
    if (embedTemplate.bannerUrl) embed.setImage(embedTemplate.bannerUrl);
    else if (cfg.globalBannerUrl) embed.setImage(cfg.globalBannerUrl);
    if (embedTemplate.thumbnailUrl) embed.setThumbnail(embedTemplate.thumbnailUrl);
    if (embedTemplate.footerText) {
      embed.setFooter({
        text: embedTemplate.footerText.slice(0, 2048),
        iconURL: embedTemplate.footerIconUrl || undefined
      });
    } else {
      embed.setFooter({ text: BRAND.footer });
    }

    const payload = { embeds: [embed] };
    const invite = cfg.globalInviteUrl || embedTemplate.buttonUrl;
    if (invite && !embedTemplate.buttonLabel) {
      payload.content = invite.slice(0, MAX_CONTENT);
    }
    if (embedTemplate.buttonLabel && embedTemplate.buttonUrl) {
      payload.components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(embedTemplate.buttonLabel.slice(0, 80))
            .setURL(embedTemplate.buttonUrl)
            .setStyle(ButtonStyle.Link)
        )
      ];
    }
    return payload;
  }

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
