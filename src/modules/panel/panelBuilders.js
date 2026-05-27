const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { BRAND, DIVULGATION } = require('../../config/constants');
const { PANEL } = require('./panelIds');
const { fmtDate, fmtDurationMinutes } = require('./panelFormat');

const DEFAULT_GLOBAL_MSG = [
  '🚀 **Divulgação Discord — Takahashi Network**',
  '> Alcance seu público-alvo e aumente seus lucros hoje mesmo!',
  '> Parcerias em canais de divulgação — sem DM.',
  '',
  'Acesse nosso Discord para mais informações.'
].join('\n');

function panelImage() {
  return process.env.PANEL_BANNER_URL || null;
}

function withBanner(embed) {
  const url = panelImage();
  if (url) embed.setImage(url);
  return embed;
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('↩️ Voltar')
  );
}

function buildHomePanel(stats) {
  const estado = stats.botRunning ? '🟢 Ativo' : '🔴 Parado';
  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('🛡️ Painel de Controle')
      .setDescription('| Bem-vindo ao sistema de divulgação automática!')
      .addFields(
        { name: '🔧 Estado', value: estado, inline: true },
        { name: '👤 Tokens', value: `${stats.tokenCount ?? 0}/∞`, inline: true },
        { name: '🔥 Servidores', value: `${stats.configuredServers}/∞`, inline: true },
        { name: '⚡ Ciclos', value: String(stats.totalCycles), inline: true },
        { name: '❌ Erros', value: String(stats.errorsTotal), inline: true },
        { name: '🚀 Divulgações', value: String(stats.totalDivulgations || stats.adsCount), inline: true },
        {
          name: '📊 Tracking Ativos',
          value: '0',
          inline: false
        },
        {
          name: '⏱️ Último Envio',
          value: stats.lastSendAt ? fmtDate(stats.lastSendAt) : 'Nunca',
          inline: true
        },
        {
          name: '🕒 Rede',
          value: `${stats.partnerCount} servidor(es) no bot`,
          inline: true
        }
      )
      .setFooter({ text: 'Sistema Multi-Servidor • Canais de Parceria' })
      .setTimestamp()
  );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.TOKENS).setStyle(ButtonStyle.Primary).setLabel('👤 Tokens'),
    new ButtonBuilder().setCustomId(PANEL.SERVERS).setStyle(ButtonStyle.Primary).setLabel('🔥 Servidores'),
    new ButtonBuilder().setCustomId(PANEL.MESSAGE).setStyle(ButtonStyle.Primary).setLabel('📬 Mensagem'),
    new ButtonBuilder().setCustomId(PANEL.TRACKING).setStyle(ButtonStyle.Primary).setLabel('🤖 Monitoramento')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL.STOP)
      .setStyle(ButtonStyle.Danger)
      .setLabel(stats.botRunning ? 'Parar Bot' : 'Iniciar Bot'),
    new ButtonBuilder().setCustomId(PANEL.SCHEDULE).setStyle(ButtonStyle.Secondary).setLabel('⏰ Agendar'),
    new ButtonBuilder().setCustomId(PANEL.DIVULGATIONS).setStyle(ButtonStyle.Secondary).setLabel('🚀 Divulgações'),
    new ButtonBuilder().setCustomId(PANEL.LOGS).setStyle(ButtonStyle.Secondary).setLabel('📋 Logs'),
    new ButtonBuilder().setCustomId(PANEL.REFRESH).setStyle(ButtonStyle.Secondary).setLabel('🔄 Atualizar')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL.CYCLES)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('⚙️ Configurar Ciclos')
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function buildTokensPanel(tokenRows = []) {
  const active = tokenRows.filter((t) => t.active);
  const lines = [`**Total:** \`${active.length}/∞\` token(s) de usuário`, ''];

  if (!tokenRows.length) {
    lines.push(
      '_Nenhum token cadastrado._',
      '',
      'Adicione o token da **sua conta Discord** (não do bot).',
      'Com tokens ativos, as mensagens saem **como você** nos canais — o bot não precisa estar no servidor parceiro.'
    );
  } else {
    for (const t of tokenRows) {
      const status = t.active ? '🟢 ATIVO' : `🔴 ${t.lastError ? 'ERRO' : 'INATIVO'}`;
      lines.push(
        `**Token ${t.slot}** ${status}`,
        `• **Conta:** \`${t.username}\``,
        `• **ID:** \`${t.masked}\``,
        t.lastError ? `• **Último erro:** ${t.lastError.slice(0, 60)}` : null,
        ''
      );
    }
  }

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('👤 Gerenciamento de Tokens')
      .setDescription(lines.filter(Boolean).join('\n'))
      .setFooter({ text: `${BRAND.footer} • Conta de usuário (não bot)` })
      .setTimestamp()
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.TOKEN_ADD).setStyle(ButtonStyle.Success).setLabel('Adicionar Token'),
    new ButtonBuilder().setCustomId(PANEL.TOKEN_REMOVE).setStyle(ButtonStyle.Danger).setLabel('Remover Token'),
    new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('↩️ Voltar')
  );

  return { embeds: [embed], components: [row] };
}

function buildServersPanel(client, rows = []) {
  const lines = [];
  let idx = 0;
  for (const s of rows) {
    idx++;
    const cached = client.guilds.cache.get(s.guildId);
    const botHere = Boolean(cached);
    const next = s.nextSendAt ? fmtDate(s.nextSendAt) : '—';
    const msg = s.customMessage ? '✅ Personalizada' : '✅ Padrão';
    const nome = cached?.name || s.partnerGuildName || 'Parceiro';
    lines.push(
      `**Servidor ${idx}:** ${nome}`,
      `• **ID:** \`${s.guildId}\``,
      `• **Canal:** \`${s.adsChannelId}\``,
      `• **Envio:** ${botHere ? '🤖 Bot no servidor' : '👤 Sua conta (token)'}`,
      `• **Delay:** \`${s.delayMinutes || DIVULGATION.minIntervalMinutes}min\``,
      `• **Msg Padrão:** ${msg}`,
      `• **Próximo:** ${next}`,
      ''
    );
  }

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('🔥 Gerenciamento de Servidores')
      .setDescription(
        lines.length
          ? lines.join('\n')
          : [
              'Nenhum canal configurado.',
              '',
              '**Adicionar Servidor:** envia **na hora** e agenda o próximo pelo delay (mín. 50 min).',
              'O bot **não precisa** estar no servidor — use **Tokens** com seu token de usuário.'
            ].join('\n')
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp()
  );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.SERVER_ADD).setStyle(ButtonStyle.Success).setLabel('Adicionar Servidor'),
    new ButtonBuilder().setCustomId(PANEL.SERVER_REMOVE).setStyle(ButtonStyle.Danger).setLabel('Remover Servidor'),
    new ButtonBuilder().setCustomId(PANEL.SERVER_EDIT_MSG).setStyle(ButtonStyle.Primary).setLabel('Editar Mensagem')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('↩️ Voltar'),
    new ButtonBuilder()
      .setCustomId(PANEL.SERVER_SEND_NOW)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Enviar Agora'),
    new ButtonBuilder()
      .setCustomId(PANEL.SERVER_RESET_NEXT)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Resetar Próximo Envio')
  );

  return { embeds: [embed], components: [row1, row2] };
}

function buildMessagePanel(cfg, serverCount) {
  const msg = cfg.globalMessage || DEFAULT_GLOBAL_MSG;
  const preview = msg.length > 900 ? `${msg.slice(0, 897)}...` : msg;

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('Prévia da Mensagem Global:')
      .setDescription(preview)
      .setFooter({
        text: `${msg.length} caracteres | Cada servidor pode ter sua própria mensagem`
      })
      .setTimestamp()
  );

  const header = new EmbedBuilder()
    .setColor(BRAND.color)
    .setDescription(
      [
        `**Tipo (Global):** ${cfg.globalMessage ? 'Personalizada' : 'Padrão'}`,
        `**Mensagens por Servidor:** ${cfg.messagesPerCycle || 1}`
      ].join('\n')
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.MSG_EDIT_GLOBAL).setStyle(ButtonStyle.Primary).setLabel('Editar Mensagem Global'),
    new ButtonBuilder().setCustomId(PANEL.MSG_DEFAULT).setStyle(ButtonStyle.Secondary).setLabel('Usar Padrão'),
    new ButtonBuilder().setCustomId(PANEL.MSG_FULL).setStyle(ButtonStyle.Secondary).setLabel('Ver Completa')
  );

  const row2 = backRow();

  return { embeds: [header, embed], components: [row1, row2] };
}

function buildTrackingPanel(cfg = {}) {
  const invite = cfg.globalInviteUrl?.trim();
  const description = invite
    ? [
        '✅ **Convite principal configurado**',
        '',
        `🔗 **URL:** ${invite}`,
        '',
        'Use **Ver Detalhes** para revisar ou **Deletar Tracking** para remover.'
      ].join('\n')
    : [
        '🔍 **Nenhum convite de tracking configurado**',
        '',
        'Clique em **Adicionar Tracking** e informe o link do convite Discord que deseja rastrear nas divulgações.'
      ].join('\n');

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('👥 Bot Tracking - Rastreamento de Convites')
      .setDescription(description)
      .setFooter({ text: BRAND.footer })
      .setTimestamp()
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL.TRACKING_ADD)
      .setStyle(ButtonStyle.Success)
      .setLabel(invite ? 'Alterar Convite' : 'Adicionar Tracking'),
    new ButtonBuilder()
      .setCustomId(PANEL.TRACKING_VIEW)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Ver Detalhes')
      .setDisabled(!invite),
    new ButtonBuilder()
      .setCustomId(PANEL.TRACKING_DEL)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Deletar Tracking')
      .setDisabled(!invite),
    new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('↩️ Voltar')
  );

  return { embeds: [embed], components: [row] };
}

function buildSchedulePanel(cfg) {
  const sched = cfg.scheduledAt
    ? `📅 Agendado para: **${fmtDate(cfg.scheduledAt)}**`
    : '• Nenhum agendamento ativo';

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('⏰ Agendar Divulgação')
      .setDescription(sched)
      .setFooter({ text: BRAND.footer })
      .setTimestamp()
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.SCHEDULE_CREATE).setStyle(ButtonStyle.Success).setLabel('Criar Agendamento'),
    new ButtonBuilder().setCustomId(PANEL.SCHEDULE_CANCEL).setStyle(ButtonStyle.Danger).setLabel('Cancelar Agendamento'),
    new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('↩️ Voltar')
  );

  return { embeds: [embed], components: [row] };
}

function buildDivulgationsListPanel(runs, currentRun) {
  const lines = ['Use o botão abaixo para ver detalhes de cada divulgação', ''];
  const list = runs.slice(0, 5);
  for (const r of list) {
    const dur = fmtDurationMinutes(r.startedAt, r.endedAt);
    lines.push(
      `📋 **Divulgação #${r.number}**`,
      `📅 ${fmtDate(r.startedAt)}`,
      `⏱ ${dur}min | 💬 ${r.messagesSent} msgs | 🔄 ${r.cyclesDone} ciclos | ❌ ${r.errorsCount} erros`,
      ''
    );
  }

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setDescription(lines.join('\n') || 'Nenhuma divulgação registrada ainda.')
      .setFooter({ text: BRAND.footer })
      .setTimestamp()
  );

  const options = [];
  if (currentRun) {
    const dur = fmtDurationMinutes(currentRun.startedAt, null);
    options.push({
      label: '🟢 Divulgação Atual (Em Andamento)',
      description: `${dur}min | ${currentRun.messagesSent} msgs | ${currentRun.cyclesDone} ciclos`,
      value: `current`
    });
  }
  for (const r of runs.slice(0, 4)) {
    const d = new Date(r.startedAt);
    const label = `Divulgação #${r.number} - ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({
      label,
      description: `${fmtDurationMinutes(r.startedAt, r.endedAt)}min | ${r.messagesSent} msgs | ${r.cyclesDone} ciclos`,
      value: String(r.number)
    });
  }

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(PANEL.DIV_SELECT)
        .setStyle(ButtonStyle.Primary)
        .setLabel('🔍 Ver Divulgação Específica'),
      new ButtonBuilder().setCustomId(PANEL.DIV_CLEAR).setStyle(ButtonStyle.Danger).setLabel('🗑 Limpar Histórico'),
      new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('🔙 Voltar ao Painel')
    )
  ];

  if (options.length) {
    components.unshift(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${PANEL.DIV_SELECT}:menu`)
          .setPlaceholder('Selecione uma divulgação para ver detalhes')
          .addOptions(options.slice(0, 25))
      )
    );
  }

  return { embeds: [embed], components };
}

function buildDivulgationDetail(run, isCurrent) {
  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle(isCurrent ? 'Divulgação Atual (Em Andamento)' : `Divulgação #${run.number}`)
      .setDescription(isCurrent ? '🚀 Esta divulgação está rodando agora!' : 'Divulgação finalizada.')
      .addFields(
        { name: 'Início', value: fmtDate(run.startedAt), inline: true },
        {
          name: 'Fim',
          value: run.endedAt ? fmtDate(run.endedAt) : 'Em andamento...',
          inline: true
        },
        {
          name: 'Duração',
          value: `${fmtDurationMinutes(run.startedAt, run.endedAt)} minutos`,
          inline: true
        },
        { name: 'Mensagens Enviadas', value: String(run.messagesSent), inline: true },
        { name: 'Ciclos Completados', value: String(run.cyclesDone), inline: true },
        { name: 'Erros', value: String(run.errorsCount), inline: true }
      )
      .setFooter({ text: isCurrent ? '💡 Atualizando em tempo real' : BRAND.footer })
      .setTimestamp()
  );

  return { embeds: [embed], components: [backRow()] };
}

function buildCyclesPanel(cfg) {
  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('⚙️ Configuração de Ciclos')
      .setDescription('Configure como os ciclos de envio funcionam para otimizar suas divulgações!')
      .addFields(
        {
          name: '📫 Mensagens por Ciclo',
          value: `${cfg.messagesPerCycle} mensagem(ns) por servidor em cada ciclo`,
          inline: false
        },
        {
          name: '⏱️ Delay Entre Mensagens',
          value: `${cfg.delayMsgMinSec}s - ${cfg.delayMsgMaxSec}s`,
          inline: true
        },
        {
          name: '🔥 Delay Entre Servidores',
          value: `${cfg.delayGuildMinSec}s - ${cfg.delayGuildMaxSec}s`,
          inline: true
        },
        {
          name: '🔄 Delay Mínimo do Ciclo',
          value: `${cfg.minCycleMinutes} minutos`,
          inline: false
        }
      )
      .setFooter({
        text: `💡 Mínimo ${DIVULGATION.minIntervalMinutes} min entre divulgações • Anti rate limit`
      })
      .setTimestamp()
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PANEL.CYCLES_EDIT).setStyle(ButtonStyle.Primary).setLabel('Editar Configurações'),
    new ButtonBuilder().setCustomId(PANEL.CYCLES_RESET).setStyle(ButtonStyle.Secondary).setLabel('Restaurar Padrão'),
    new ButtonBuilder().setCustomId(PANEL.BACK).setStyle(ButtonStyle.Secondary).setLabel('↩️ Voltar')
  );

  return { embeds: [embed], components: [row] };
}

function buildLogsPanel(events) {
  const lines = events.length
    ? events.map((e) => `• \`${fmtDate(e.createdAt)}\` **${e.type}** — ${e.message.slice(0, 80)}`)
    : ['Nenhum log recente.'];

  const embed = withBanner(
    new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('📋 Logs do Sistema')
      .setDescription(lines.join('\n'))
      .setFooter({ text: BRAND.footer })
      .setTimestamp()
  );

  return { embeds: [embed], components: [backRow()] };
}

function buildGlobalMessageFull(cfg) {
  const msg = cfg.globalMessage || DEFAULT_GLOBAL_MSG;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('Mensagem Global Completa')
        .setDescription(msg)
    ],
    components: [backRow()]
  };
}

module.exports = {
  DEFAULT_GLOBAL_MSG,
  buildHomePanel,
  buildTokensPanel,
  buildServersPanel,
  buildMessagePanel,
  buildTrackingPanel,
  buildSchedulePanel,
  buildDivulgationsListPanel,
  buildDivulgationDetail,
  buildCyclesPanel,
  buildLogsPanel,
  buildGlobalMessageFull
};
