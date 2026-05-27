const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { buildRedePanel } = require('../../modules/network/redePanel');
const { deferEphemeral, EPHEMERAL } = require('../../utils/interaction');
const { isNetworkAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rede')
    .setDescription(`Ligar ou desligar a ${BRAND.name} (parada global de anúncios).`),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(client, interaction) {
    if (!isNetworkAdmin(interaction)) {
      await interaction.reply({
        content: 'Sem permissão. Apenas administradores ou donos da rede podem usar este comando.',
        flags: EPHEMERAL
      });
      return;
    }

    await deferEphemeral(interaction);

    const enabled = await client.services.network.isEnabled();
    const queueSize = client.services.adsQueue.getQueueSize();

    await interaction.editReply(buildRedePanel({ enabled, queueSize }));
  }
};
