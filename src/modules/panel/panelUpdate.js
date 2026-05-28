const { EmbedBuilder } = require('discord.js');
const { fmtDate } = require('./panelFormat');
const { EPHEMERAL } = require('../../utils/interaction');

/**
 * Marca embeds com timestamp e rodapé de última atualização (feedback visual real).
 */
function stampPanelPayload(payload) {
  if (!payload?.embeds?.length) return payload;
  const now = new Date();
  return {
    ...payload,
    embeds: payload.embeds.map((embed) => {
      const base =
        embed instanceof EmbedBuilder ? EmbedBuilder.from(embed.data) : new EmbedBuilder(embed);
      const footerBase = (base.data.footer?.text || 'Takahashi Ads').replace(/\s•\sAtualizado.*$/i, '');
      return base.setTimestamp(now).setFooter({ text: `${footerBase} • Atualizado ${fmtDate(now)}` });
    })
  };
}

function withPanelNotice(payload, notice) {
  if (!notice || !payload?.embeds?.length) return stampPanelPayload(payload);
  const stamped = stampPanelPayload(payload);
  const first = stamped.embeds[0];
  const base = first instanceof EmbedBuilder ? EmbedBuilder.from(first.data) : new EmbedBuilder(first);
  const desc = base.data.description || '';
  stamped.embeds[0] = base.setDescription(`${desc}\n\n${notice}`.trim());
  return stamped;
}

/**
 * Responde ao modal em <3s antes de operações lentas (DB, envios).
 */
async function deferModalPanel(interaction) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferUpdate();
}

/**
 * Atualiza painel ephemeral via webhook @original (editReply).
 * message.edit() falha em mensagens ephemeral (Unknown Message 10008).
 */
async function editPanelReply(interaction, payload) {
  const stamped = stampPanelPayload(payload);
  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isMessageComponent?.()) {
      await interaction.update(stamped);
      return stamped;
    }
    if (interaction.isModalSubmit?.()) {
      await interaction.deferUpdate();
    }
  }
  await interaction.editReply(stamped);
  return stamped;
}

/**
 * Atualiza embed + botões na mesma mensagem do painel (botões/select).
 */
async function refreshPanelMessage(interaction, payload) {
  return editPanelReply(interaction, payload);
}

/**
 * Após modal: atualiza embed + botões na mensagem ephemeral do painel.
 */
async function refreshPanelAfterModal(interaction, payload, { notice = null } = {}) {
  const finalPayload = notice ? withPanelNotice(payload, notice) : payload;
  return editPanelReply(interaction, finalPayload);
}

module.exports = {
  stampPanelPayload,
  withPanelNotice,
  refreshPanelMessage,
  refreshPanelAfterModal,
  deferModalPanel,
  editPanelReply,
  EPHEMERAL
};
