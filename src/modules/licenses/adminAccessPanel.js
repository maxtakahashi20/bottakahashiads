const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { DURATION_LABELS } = require('../../config/licensing');
const { fmtDate } = require('../panel/panelFormat');

const BTN = {
  GEN_1M: 'saas:admin:gen:MONTH_1',
  GEN_3M: 'saas:admin:gen:MONTH_3',
  GEN_1Y: 'saas:admin:gen:YEAR_1',
  LIST: 'saas:admin:list'
};

function buildAdminAccessHome({ stats, recent }) {
  const lines = (recent || []).slice(0, 5).map((l) => {
    const st = l.status;
    const dur = DURATION_LABELS[l.duration] || l.duration;
    return `\`${l.code}\` — ${dur} — **${st}**`;
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🔐 Painel de Acesso — Licenças SaaS')
    .setDescription('Gere licenças para clientes. Cada código ativa um ambiente **isolado**.')
    .addFields(
      { name: 'Pendentes', value: String(stats?.pending ?? 0), inline: true },
      { name: 'Ativas', value: String(stats?.activated ?? 0), inline: true },
      { name: 'Clientes', value: String(stats?.tenants ?? 0), inline: true },
      {
        name: 'Últimas licenças',
        value: lines.length ? lines.join('\n') : '_Nenhuma ainda_'
      }
    )
    .setFooter({ text: 'Somente administrador autorizado da plataforma' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BTN.GEN_1M)
      .setLabel('1 mês')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BTN.GEN_3M)
      .setLabel('3 meses')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BTN.GEN_1Y)
      .setLabel('1 ano')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(BTN.LIST).setLabel('Ver /licenses').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildLicenseCreated(license) {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('✅ Licença gerada')
    .setDescription(
      [
        'Copie e envie ao cliente:',
        '',
        `\`\`\`${license.code}\`\`\``,
        '',
        `**Duração:** ${DURATION_LABELS[license.duration]}`,
        `**Status:** ${license.status}`,
        '',
        'O cliente ativa com `/ativar`.'
      ].join('\n')
    )
    .setTimestamp();
}

module.exports = { buildAdminAccessHome, buildLicenseCreated, BTN };
