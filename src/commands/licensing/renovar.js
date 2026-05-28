const { SlashCommandBuilder } = require('discord.js');
const { validateLicenseFormat } = require('../../modules/licenses/licenseValidators');
const { fmtDate } = require('../../modules/panel/panelFormat');
const { dbErrorMessage } = require('../../utils/prismaSafe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('renovar')
    .setDescription('Renovar plano com uma licença nova (ainda não usada).')
    .addStringOption((opt) =>
      opt.setName('codigo').setDescription('Nova licença takahashi-store-...').setRequired(true)
    ),

  async execute(client, interaction) {
    const raw = interaction.options.getString('codigo');
    const v = validateLicenseFormat(raw);
    if (!v.ok) {
      await interaction.editReply({ content: `❌ ${v.error}` });
      return;
    }

    try {
      const result = await client.services.licenses.renewWithLicense({
        code: v.code,
        userId: interaction.user.id
      });

      if (!result.ok) {
        await interaction.editReply({ content: `❌ ${result.error}` });
        return;
      }

      await interaction.editReply({
        content: `✅ Plano renovado! Novo vencimento: **${fmtDate(result.endsAt)}**`
      });
    } catch (err) {
      client.logger.error({ err }, 'renovar command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}` });
    }
  }
};
