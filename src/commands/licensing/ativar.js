const { SlashCommandBuilder } = require('discord.js');
const { validateLicenseFormat } = require('../../modules/licenses/licenseValidators');
const { fmtDate } = require('../../modules/panel/panelFormat');
const { dbErrorMessage } = require('../../utils/prismaSafe');
const { DURATION_LABELS } = require('../../config/licensing');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ativar')
    .setDescription('Ativar licença e criar seu ambiente Takahashi Ads.')
    .addStringOption((opt) =>
      opt.setName('licenca').setDescription('Código takahashi-store-...').setRequired(true)
    ),

  async execute(client, interaction) {
    const raw = interaction.options.getString('licenca');
    const v = validateLicenseFormat(raw);
    if (!v.ok) {
      await interaction.editReply({ content: `❌ ${v.error}` });
      return;
    }

    try {
      const result = await client.services.licenses.activate({
        code: v.code,
        userId: interaction.user.id,
        displayName: interaction.user.globalName || interaction.user.username
      });

      if (!result.ok) {
        await interaction.editReply({ content: `❌ ${result.error}` });
        return;
      }

      await interaction.editReply({
        content: [
          '✅ **Ambiente ativado com sucesso!**',
          '',
          `📦 Plano: **${DURATION_LABELS[result.license.duration]}**`,
          `📅 Válido até: **${fmtDate(result.endsAt)}**`,
          '',
          'Use `/painel` (**Takahashi Ads**, não outro bot) para configurar servidores e divulgação.',
          'Use `/status` e `/plano` para acompanhar sua assinatura.'
        ].join('\n')
      });
    } catch (err) {
      client.logger.error({ err }, 'ativar command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err, 'Falha ao ativar licença.')}` });
    }
  }
};
