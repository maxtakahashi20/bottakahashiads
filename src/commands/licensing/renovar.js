const { SlashCommandBuilder } = require('discord.js');
const { EPHEMERAL } = require('../../utils/interaction');
const { validateLicenseFormat } = require('../../modules/licenses/licenseValidators');
const { fmtDate } = require('../../modules/panel/panelFormat');

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
      await interaction.reply({ content: `❌ ${v.error}`, flags: EPHEMERAL });
      return;
    }

    const result = await client.services.licenses.renewWithLicense({
      code: v.code,
      userId: interaction.user.id
    });

    if (!result.ok) {
      await interaction.reply({ content: `❌ ${result.error}`, flags: EPHEMERAL });
      return;
    }

    await interaction.reply({
      content: `✅ Plano renovado! Novo vencimento: **${fmtDate(result.endsAt)}**`,
      flags: EPHEMERAL
    });
  }
};
