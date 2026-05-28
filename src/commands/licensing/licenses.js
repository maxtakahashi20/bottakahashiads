const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { DURATION_LABELS } = require('../../config/licensing');
const { BRAND } = require('../../config/constants');
const { fmtDate } = require('../../modules/panel/panelFormat');
const { dbErrorMessage } = require('../../utils/prismaSafe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('licenses')
    .setDescription('(Dono) Listar licenças recentes.')
    .addIntegerOption((opt) =>
      opt.setName('limite').setDescription('Quantidade (máx. 25)').setMinValue(1).setMaxValue(25)
    ),

  async execute(client, interaction) {
    if (!isPlatformOwner(interaction)) {
      await interaction.editReply({ content: '❌ Sem permissão.' });
      return;
    }

    try {
      const limit = interaction.options.getInteger('limite') || 15;
      const rows = await client.services.licenses.listRecent(limit);

      const lines = rows.map((l) => {
        const who = l.tenant?.displayName || l.activatedByUserId || '—';
        return [
          `\`${l.code}\``,
          `${DURATION_LABELS[l.duration]} | **${l.status}**`,
          l.activatedAt ? `Ativada: ${fmtDate(l.activatedAt)} | ${who}` : `Criada: ${fmtDate(l.createdAt)}`
        ].join('\n');
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('📋 Licenças')
        .setDescription(lines.length ? lines.join('\n\n') : '_Nenhuma licença._')
        .setFooter({ text: `${rows.length} registro(s)` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      client.logger.error({ err }, 'licenses command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}` });
    }
  }
};
