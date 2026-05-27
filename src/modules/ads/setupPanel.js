const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType
} = require('discord.js');
const { BRAND, DIVULGATION } = require('../../config/constants');
const { fmtDate } = require('../panel/panelFormat');

function buildSetupPanel(settings, channelLabel = null) {
  const channelInfo = settings.adsChannelId
    ? `<#${settings.adsChannelId}>`
    : '⚠️ **Não configurado** — selecione abaixo';

  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle('Painel de Configuração — Takahashi Network')
    .setDescription(
      [
        'Configure como este servidor participa da **rede de parcerias**.',
        '',
        '**Modo de entrega:** mensagens no **canal de divulgação** configurado (sem DM).',
        '',
        `**Status:** ${settings.adsEnabled ? '✅ Ativo' : '⛔ Desativado'}`,
        `**Canal de divulgação:** ${channelLabel || channelInfo}`,
        `**Delay entre envios:** \`${settings.delayMinutes || DIVULGATION.minIntervalMinutes} min\` (mín. ${DIVULGATION.minIntervalMinutes})`,
        settings.nextSendAt ? `**Próximo envio:** ${fmtDate(settings.nextSendAt)}` : '',
        `**Cooldown (Usuário):** \`${settings.userCooldownSec}s\``,
        `**Cooldown (Servidor):** \`${settings.guildCooldownSec}s\``,
        `**Categorias permitidas:** ${
          settings.allowedCategories?.length
            ? settings.allowedCategories.map((c) => `\`${c}\``).join(' ')
            : '`Todas`'
        }`,
        '',
        '_Use `/painel` para gerenciar todos os servidores da rede._'
      ]
        .filter(Boolean)
        .join('\n')
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date());

  const rowChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('ads:setup:channelSelect')
      .setPlaceholder('Selecione o canal de divulgação')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ads:setup:toggle')
      .setStyle(settings.adsEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setLabel(settings.adsEnabled ? 'Desativar rede' : 'Ativar rede'),
    new ButtonBuilder()
      .setCustomId('ads:setup:cooldowns')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Cooldowns'),
    new ButtonBuilder()
      .setCustomId('ads:setup:categories')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Categorias')
  );

  return { embeds: [embed], components: [rowChannel, rowButtons] };
}

module.exports = { buildSetupPanel };
