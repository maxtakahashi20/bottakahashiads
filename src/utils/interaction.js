const { MessageFlags } = require('discord.js');

const EPHEMERAL = MessageFlags.Ephemeral;

/**
 * Responde de forma segura (reply ou editReply se já deferiu).
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').InteractionReplyOptions} options
 */
async function safeReply(interaction, options) {
  const payload = { ...options, flags: (options.flags ?? 0) | EPHEMERAL };

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

/**
 * @param {import('discord.js').Interaction} interaction
 */
async function deferEphemeral(interaction) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ flags: EPHEMERAL });
}

/**
 * Componentes (botões/select): evita timeout antes de update/editReply.
 * @param {import('discord.js').MessageComponentInteraction} interaction
 */
async function deferComponent(interaction) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferUpdate();
}

async function ephemeralFollowUp(interaction, options) {
  return interaction.followUp({ ...options, flags: (options.flags ?? 0) | EPHEMERAL });
}

module.exports = { EPHEMERAL, safeReply, deferEphemeral, deferComponent, ephemeralFollowUp };
