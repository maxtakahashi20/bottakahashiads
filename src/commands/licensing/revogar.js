const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { deferEphemeral } = require('../../utils/interaction');
const { validateLicenseFormat } = require('../../modules/licenses/licenseValidators');
const { dbErrorMessage } = require('../../utils/prismaSafe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('revogar')
    .setDescription('(Dono) Revogar licença e suspender ambiente do cliente.')
    .addStringOption((opt) =>
      opt.setName('codigo').setDescription('Código takahashi-store-...').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('motivo').setDescription('Motivo da revogação').setRequired(false)
    ),

  async execute(client, interaction) {
    await deferEphemeral(interaction);

    if (!isPlatformOwner(interaction)) {
      await interaction.editReply({ content: '❌ Sem permissão.' });
      return;
    }

    const raw = interaction.options.getString('codigo');
    const v = validateLicenseFormat(raw);
    if (!v.ok) {
      await interaction.editReply({ content: `❌ ${v.error}` });
      return;
    }

    try {
      const result = await client.services.licenses.revoke({
        code: v.code,
        revokedByUserId: interaction.user.id,
        reason: interaction.options.getString('motivo')
      });

      if (!result.ok) {
        await interaction.editReply({ content: `❌ ${result.error}` });
        return;
      }

      await interaction.editReply({
        content: `✅ Licença \`${result.license.code}\` revogada. Ambiente do cliente suspenso.`
      });
    } catch (err) {
      client.logger.error({ err }, 'revogar command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}` });
    }
  }
};
