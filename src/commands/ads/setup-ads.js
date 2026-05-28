const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { buildSetupPanel } = require('../../modules/ads/setupPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-ads')
    .setDescription('Configurar o sistema de anúncios/parcerias da Takahashi Network.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const s = await client.services.guildSettings.ensure(guildId);

    await interaction.editReply(buildSetupPanel(s));
  }
};
