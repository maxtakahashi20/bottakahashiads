const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { EPHEMERAL } = require('../../utils/interaction');
const { validateLicenseFormat } = require('../../modules/licenses/licenseValidators');

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
    if (!isPlatformOwner(interaction)) {
      await interaction.reply({ content: '❌ Sem permissão.', flags: EPHEMERAL });
      return;
    }

    const raw = interaction.options.getString('codigo');
    const v = validateLicenseFormat(raw);
    if (!v.ok) {
      await interaction.reply({ content: `❌ ${v.error}`, flags: EPHEMERAL });
      return;
    }

    const result = await client.services.licenses.revoke({
      code: v.code,
      revokedByUserId: interaction.user.id,
      reason: interaction.options.getString('motivo')
    });

    if (!result.ok) {
      await interaction.reply({ content: `❌ ${result.error}`, flags: EPHEMERAL });
      return;
    }

    await interaction.reply({
      content: `✅ Licença \`${result.license.code}\` revogada. Ambiente do cliente suspenso.`,
      flags: EPHEMERAL
    });
  }
};
