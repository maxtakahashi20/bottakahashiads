const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner, MSG_PLATFORM_ACCESS_DENIED } = require('../../utils/permissions');
const { safeReply } = require('../../utils/interaction');
const { buildFriendsDmModal } = require('../../modules/ads/dmBroadcastModal');
const { userFacingError } = require('../../utils/discordErrors');

module.exports = {
  skipCommandLoading: true,

  data: new SlashCommandBuilder()
    .setName('enviardm')
    .setDescription('DM para todos os seus amigos (token da sua conta).')
    .setDMPermission(true),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} _client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(_client, interaction) {
    if (!isPlatformOwner(interaction)) {
      await safeReply(interaction, {
        content: userFacingError(MSG_PLATFORM_ACCESS_DENIED, { title: 'Acesso negado' })
      });
      return;
    }

    await interaction.showModal(buildFriendsDmModal());
  }
};
