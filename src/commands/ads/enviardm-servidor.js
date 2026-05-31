const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { safeReply } = require('../../utils/interaction');
const { isSnowflake } = require('../../utils/dmBroadcast');
const { buildGuildDmModal } = require('../../modules/ads/dmBroadcastModal');
const { userFacingError } = require('../../utils/discordErrors');

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
        content: userFacingError(
          'Comando restrito ao identificador configurado em BOT_OWNER_IDS.',
          { title: 'Acesso negado' }
        )
      });
      return;
    }

    await interaction.showModal(buildGuildDmModal());
  }
};
