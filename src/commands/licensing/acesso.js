const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { EPHEMERAL } = require('../../utils/interaction');
const { DURATION_LABELS } = require('../../config/licensing');

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
      await interaction.reply({
        content: '❌ Apenas o dono da plataforma (`BOT_OWNER_IDS`) pode gerar licenças.',
        flags: EPHEMERAL
      });
      return;
    }

    const periodo = interaction.options.getString('periodo');
    const duration = DURATION_MAP[periodo];
    const note = interaction.options.getString('nota');

    await interaction.deferReply({ flags: EPHEMERAL });

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
  }
};
