const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { DURATION_LABELS } = require('../../config/licensing');
const { dbErrorMessage } = require('../../utils/prismaSafe');

const DURATION_MAP = {
  '1m': 'MONTH_1',
  '3m': 'MONTH_3',
  '1a': 'YEAR_1'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('acesso')
    .setDescription('(Dono) Gerar licença Takahashi Ads SaaS.')
    .addStringOption((opt) =>
      opt
        .setName('periodo')
        .setDescription('Duração da licença')
        .setRequired(true)
        .addChoices(
          { name: '1 mês', value: '1m' },
          { name: '3 meses', value: '3m' },
          { name: '1 ano', value: '1a' }
        )
    )
    .addStringOption((opt) =>
      opt.setName('nota').setDescription('Nota interna (opcional)').setRequired(false)
    ),

  async execute(client, interaction) {
    if (!isPlatformOwner(interaction)) {
      await interaction.editReply({
        content:
          '❌ Apenas o dono da plataforma pode gerar licenças.\n' +
          'Seu usuário não está autorizado como administrador da plataforma. Contate o suporte.'
      });
      return;
    }

    try {
      const periodo = interaction.options.getString('periodo');
      const duration = DURATION_MAP[periodo];
      const note = interaction.options.getString('nota');

      const license = await client.services.licenses.generate({
        duration,
        createdByUserId: interaction.user.id,
        note
      });

      await interaction.editReply({
        content: [
          `✅ Licença **${DURATION_LABELS[duration]}** criada.`,
          '',
          '```',
          license.code,
          '```',
          '',
          'Envie ao cliente para usar `/ativar`.'
        ].join('\n')
      });
    } catch (err) {
      client.logger.error({ err }, 'acesso command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err, 'Falha ao gerar licença.')}` });
    }
  }
};
