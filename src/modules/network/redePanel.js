const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

/**
 * @param {{ enabled: boolean, queueSize: number }} state
 */
function buildRedePanel(state) {
  const embed = new EmbedBuilder()
    .setColor(state.enabled ? BRAND.accent : 0xef4444)
    .setTitle('Controle da Rede — Takahashi Network')
    .setDescription(
      [
        state.enabled
          ? '🟢 **Rede LIGADA** — anúncios em canais de parceria estão permitidos.'
          : '🔴 **Rede DESLIGADA** — nenhum anúncio novo será enviado.',
        '',
        `**Fila de envio:** \`${state.queueSize}\` pendente(s)`,
        '',
        '_Ao desligar, a fila é esvaziada e `/anunciar` fica bloqueado até ligar de novo._'
      ].join('\n')
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ads:rede:on')
      .setLabel('Ligar rede')
      .setStyle(ButtonStyle.Success)
      .setDisabled(state.enabled),
    new ButtonBuilder()
      .setCustomId('ads:rede:off')
      .setLabel('Desligar rede')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!state.enabled),
    new ButtonBuilder().setCustomId('ads:rede:refresh').setLabel('Atualizar').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildRedePanel };
