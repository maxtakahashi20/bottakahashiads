const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { BRAND } = require('../../config/constants');

function buildSetupPanel(settings) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle('Painel de Configuração — Ads Network')
    .setDescription(
      [
        'Configure como este servidor participa da **Takahashi Network**.',
        '',
        '**Modo de entrega:** mensagens diretas (DM) para cada membro do servidor — **nada é postado em canais**.',
        '',
        `**Status:** ${settings.adsEnabled ? '✅ Ativo (recebe anúncios na DM)' : '⛔ Desativado'}`,
        `**Cooldown (Usuário):** \`${settings.userCooldownSec}s\``,
        `**Cooldown (Servidor):** \`${settings.guildCooldownSec}s\``,
        `**Categorias permitidas:** ${
          settings.allowedCategories?.length
            ? settings.allowedCategories.map((c) => `\`${c}\``).join(' ')
            : '`Todas`'
        }`,
        '',
        '_Membros com DM fechada não recebem o anúncio (contado como falha)._'
      ].join('\n')
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date());

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

  return { embeds: [embed], components: [rowButtons] };
}

module.exports = { buildSetupPanel };
