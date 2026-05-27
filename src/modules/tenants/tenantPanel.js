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
  REFRESH: 'saas:tenant:refresh',
  TOGGLE_BOT: 'saas:tenant:toggle_bot',
  SEND_NOW: 'saas:tenant:send_now'
};

function buildTenantHome({ tenant, subscription, cfg, serverCount }) {
  const ends = subscription?.endsAt ? fmtDate(subscription.endsAt) : '—';
  const plan = subscription?.license?.duration
    ? DURATION_LABELS[subscription.license.duration]
    : '—';

  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`📦 Seu ambiente — ${tenant.displayName || 'Takahashi Ads'}`)
    .setDescription('Painel do **seu** espaço isolado. Dados e servidores não são compartilhados.')
    .addFields(
      { name: 'Status', value: tenant.status === 'ACTIVE' ? '🟢 Ativo' : '🔴 Inativo', inline: true },
      { name: 'Plano', value: plan, inline: true },
      { name: 'Expira em', value: ends, inline: true },
      { name: 'Bot divulgação', value: cfg?.botRunning ? '▶️ Ligado' : '⏸ Pausado', inline: true },
      { name: 'Servidores', value: String(serverCount), inline: true },
      { name: 'Ciclos', value: String(cfg?.totalCycles ?? 0), inline: true }
    )
    .setFooter({ text: `${BRAND.storeName} • Tenant ${tenant.id.slice(0, 8)}…` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BTN.REFRESH)
      .setLabel('Atualizar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BTN.TOGGLE_BOT)
      .setLabel(cfg?.botRunning ? 'Pausar bot' : 'Iniciar bot')
      .setStyle(cfg?.botRunning ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BTN.SEND_NOW)
      .setLabel('Enviar agora')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildTenantHome, BTN };
