const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { safeReply } = require('../../utils/interaction');
const { buildGuildDmModal } = require('../../modules/ads/dmBroadcastModal');

module.exports = {
  skipCommandLoading: true,

  data: new SlashCommandBuilder()
    .setName('enviardm-servidor')
    .setDescription('[BOT_OWNER_IDS] DM nos membros de um servidor (token da sua conta).')
    .setDMPermission(true),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} _client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(_client, interaction) {
    if (!isPlatformOwner(interaction)) {
      await safeReply(interaction, {
        content: '🔒 Apenas quem está em `BOT_OWNER_IDS` pode usar este comando.'
      });
      return;
    }

    await interaction.showModal(buildGuildDmModal());
  }
};
