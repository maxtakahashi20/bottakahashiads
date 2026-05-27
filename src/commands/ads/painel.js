const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderHome } = require('../../modules/panel/panelHandler');
const { isNetworkAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abrir o painel de controle da Takahashi Network.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  async execute(client, interaction) {
    if (!isNetworkAdmin(interaction)) {
      await interaction.reply({
        content: '❌ Apenas administradores podem abrir o painel.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();
    const view = await renderHome(client);
    await interaction.editReply(view);
  }
};
