const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { PANEL, MODAL, PREFIX } = require('./panelIds');
const { collectPanelStats } = require('./panelStats');
const {
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
  buildGlobalMessageFull,
  DEFAULT_GLOBAL_MSG
} = require('./panelBuilders');
const { SystemConfigService } = require('../../services/systemConfigService');
const { DivulgationRunService } = require('../../services/divulgationRunService');
const { isNetworkAdmin, isTokenOwner } = require('../../utils/permissions');
const { deferComponent, EPHEMERAL, ephemeralFollowUp } = require('../../utils/interaction');
const { fmtDate } = require('./panelFormat');
const { DIVULGATION, BRAND } = require('../../config/constants');
const { clampDelayMinutes, nextSendDate } = require('../../utils/divulgationLimits');
const {
  getPartnerServerRows,
  invalidatePanelCaches
} = require('./panelCache');
const { invalidateDivulgationCache } = require('./panelStats');
const {
  PanelContext,
  getPanelTenant,
  resolvePanelTenant,
  requirePanelAccess,
  requireTokenAccessForPanel
} = require('./panelScope');
const { dbErrorMessage } = require('../../utils/prismaSafe');
const { refreshPanelMessage, refreshPanelAfterModal, deferModalPanel } = require('./panelUpdate');

function isPanelInteraction(interaction) {
  const id = interaction.customId || '';
  return id.startsWith(PREFIX) || id.startsWith('tn:tracking');
}

const LEGACY_TRACKING_MAP = {
  'tn:tracking:add': PANEL.TRACKING_ADD,
  'tn:tracking:view': PANEL.TRACKING_VIEW,
  'tn:tracking:del': PANEL.TRACKING_DEL
};

async function requireAdmin(interaction) {
  if (!isNetworkAdmin(interaction)) {
    const payload = {
      content: '❌ Sem permissão. Apenas administradores da rede podem usar o painel.',
      embeds: [],
      components: []
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, flags: EPHEMERAL });
    }
    return false;
  }
  return true;
}

async function requireTokenOwner(interaction) {
  if (!isTokenOwner(interaction)) {
    await interaction.reply({
      content: '❌ Só o dono da rede (`BOT_OWNER_IDS`) pode gerenciar tokens de usuário.',
      flags: EPHEMERAL
    });
    return false;
  }
  return true;
}

async function renderHome(client, { force = true, tenantId } = {}) {
  const { PLATFORM_TENANT_ID } = require('./panelScope');
  const tid = tenantId || PLATFORM_TENANT_ID;
  const stats = await collectPanelStats(client, { force, tenantId: tid });
  return buildHomePanel(stats);
}

async function renderTokensView(client, tenantId) {
  const rows = await client.services.userTokens.listForPanel(tenantId);
  return buildTokensPanel(rows);
}

async function renderServersView(client, tenantId) {
  const rows = await getPartnerServerRows(client, { force: true, tenantId });
  return buildServersPanel(client, rows);
}

async function renderMessageView(client, ctx, tenantId) {
  const [cfg, stats] = await Promise.all([ctx.getConfig(), collectPanelStats(client, { force: true, tenantId })]);
  return buildMessagePanel(cfg, stats.configuredServers);
}

async function renderScheduleView(ctx) {
  const cfg = await ctx.getConfig();
  return buildSchedulePanel(cfg);
}

async function renderDivulgationsView(ctx) {
  const [runs, current] = await Promise.all([ctx.divRuns.listRecent(10), ctx.divRuns.getCurrent()]);
  return buildDivulgationsListPanel(runs, current);
}

async function renderLogsView(client) {
  const events = await client.prisma.logEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15
  });
  return buildLogsPanel(events);
}

async function renderCyclesView(ctx) {
  const cfg = await ctx.getConfig();
  return buildCyclesPanel(cfg);
}

const MODAL_BUTTONS = new Set([
  PANEL.SERVER_ADD,
  PANEL.SERVER_REMOVE,
  PANEL.SERVER_EDIT_MSG,
  PANEL.MSG_EDIT_GLOBAL,
  PANEL.SCHEDULE_CREATE,
  PANEL.DIV_SELECT,
  PANEL.CYCLES_EDIT,
  PANEL.TOKEN_ADD,
  PANEL.TOKEN_REMOVE,
  PANEL.TRACKING_ADD
]);

async function handlePanelInteraction(client, interaction, overrideCustomId = null) {
  const legacyTracking = LEGACY_TRACKING_MAP[interaction.customId];
  if (!isPanelInteraction(interaction) && !overrideCustomId && !legacyTracking) return false;
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;

  const effectiveId = overrideCustomId || legacyTracking || interaction.customId;
  const opensModal = interaction.isButton() && MODAL_BUTTONS.has(effectiveId);

  // Botões que abrem modal precisam responder em <3s. Não faça chamadas de DB antes do showModal.
  if (opensModal && interaction.isButton()) {
    let modal = null;
    if (effectiveId === PANEL.TOKEN_ADD) {
      modal = new ModalBuilder().setCustomId(MODAL.TOKEN_ADD).setTitle('Adicionar Token');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('token')
            .setLabel('Token da sua conta Discord')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Cole o token do usuário aqui...')
        )
      );
    } else if (effectiveId === PANEL.TOKEN_REMOVE) {
      modal = new ModalBuilder().setCustomId(MODAL.TOKEN_REMOVE).setTitle('Remover Token');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('slot')
            .setLabel('Número do token (ex: 1)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('1')
        )
      );
    } else if (effectiveId === PANEL.SERVER_ADD) {
      modal = new ModalBuilder().setCustomId(MODAL.SERVER_ADD).setTitle('Adicionar Servidor');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('guildId')
            .setLabel('ID do Servidor')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('123456789')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('channelId')
            .setLabel('ID do Canal')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('987654321')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('delayMin')
            .setLabel(`Delay em Minutos (mínimo ${DIVULGATION.minIntervalMinutes})`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(String(DIVULGATION.minIntervalMinutes))
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('customMsg')
            .setLabel('Mensagem Personalizada (opcional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Deixe vazio para usar a mensagem global...')
        )
      );
    } else if (effectiveId === PANEL.SERVER_REMOVE) {
      modal = new ModalBuilder().setCustomId('tn:painel:modal:server_remove').setTitle('Remover Servidor');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('guildId')
            .setLabel('ID do Servidor')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    } else if (effectiveId === PANEL.SERVER_EDIT_MSG) {
      modal = new ModalBuilder().setCustomId('tn:painel:modal:server_msg').setTitle('Mensagem do Servidor');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('guildId')
            .setLabel('ID do Servidor')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('customMsg')
            .setLabel('Mensagem personalizada (vazio = global)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );
    } else if (effectiveId === PANEL.MSG_EDIT_GLOBAL) {
      modal = new ModalBuilder().setCustomId(MODAL.MSG_GLOBAL).setTitle('Editar Mensagem Global');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Digite sua mensagem de divulgação')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Digite a mensagem...')
        )
      );
    } else if (effectiveId === PANEL.SCHEDULE_CREATE) {
      modal = new ModalBuilder().setCustomId(MODAL.SCHEDULE).setTitle('Agendar Divulgação');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('datetime')
            .setLabel('Data e Hora (DD/MM/AAAA HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 15/02/2026 14:30')
        )
      );
    } else if (effectiveId === PANEL.DIV_SELECT) {
      modal = new ModalBuilder().setCustomId(MODAL.DIV_NUMBER).setTitle('Ver Divulgação');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('number')
            .setLabel('Número da divulgação')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('50')
        )
      );
    } else if (effectiveId === PANEL.CYCLES_EDIT) {
      modal = new ModalBuilder().setCustomId(MODAL.CYCLES).setTitle('Editar Ciclos');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('messagesPerCycle')
            .setLabel('Mensagens por ciclo')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('1')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('delayMsg')
            .setLabel('Delay msg min-max (ex: 2-5)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('2-5')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('delayGuild')
            .setLabel('Delay servidor min-max (ex: 15-35)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('15-35')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('minCycle')
            .setLabel('Delay mínimo do ciclo (minutos)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(String(DIVULGATION.minIntervalMinutes))
        )
      );
    } else if (effectiveId === PANEL.TRACKING_ADD) {
      modal = new ModalBuilder().setCustomId(MODAL.TRACKING_ADD).setTitle('Convite de Tracking');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('inviteUrl')
            .setLabel('Link do convite Discord')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('https://discord.gg/...')
        )
      );
    }

    if (modal) {
      await interaction.showModal(modal);
      return true;
    }
  }

  if (!opensModal) await deferComponent(interaction);

  let tenantId;
  try {
  tenantId = await resolvePanelTenant(client, interaction);
  const ctx = new PanelContext(client, tenantId);

  if (!(await requirePanelAccess(client, interaction, tenantId))) return true;

  const forceRefresh = interaction.isButton() && effectiveId === PANEL.REFRESH;
  if (forceRefresh) invalidatePanelCaches(client);

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${PANEL.DIV_SELECT}:menu`)) {
    const val = interaction.values[0];
    const current = await ctx.divRuns.getCurrent();
    if (val === 'current' && current) {
      await refreshPanelMessage(interaction, buildDivulgationDetail(current, true));
      return true;
    }
    const run = await ctx.divRuns.getByNumber(Number(val));
    if (run) await refreshPanelMessage(interaction, buildDivulgationDetail(run, run.status === 'running'));
    else await refreshPanelMessage(interaction, await renderHome(client, { tenantId }));
    return true;
  }

  if (!interaction.isButton()) {
    await refreshPanelMessage(interaction, {
      content: '⚠️ Ação não reconhecida.',
      embeds: [],
      components: []
    });
    return true;
  }

  const id = effectiveId;

  if (id === PANEL.BACK || id === PANEL.REFRESH || id === PANEL.HOME) {
    await refreshPanelMessage(interaction, await renderHome(client, { tenantId }));
    return true;
  }

  if (id === PANEL.TOKENS) {
    await refreshPanelMessage(interaction, await renderTokensView(client, tenantId));
    return true;
  }

  if (id === PANEL.SERVERS) {
    await refreshPanelMessage(interaction, await renderServersView(client, tenantId));
    return true;
  }

  if (id === PANEL.MESSAGE) {
    await refreshPanelMessage(interaction, await renderMessageView(client, ctx, tenantId));
    return true;
  }

  if (id === PANEL.TRACKING) {
    const cfg = await ctx.getConfig();
    await refreshPanelMessage(interaction, buildTrackingPanel(cfg));
    return true;
  }

  if (id === PANEL.TRACKING_ADD) {
    const cfg = await ctx.getConfig();
    const modal = new ModalBuilder().setCustomId(MODAL.TRACKING_ADD).setTitle('Convite de Tracking');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('inviteUrl')
          .setLabel('Link do convite Discord')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('https://discord.gg/...')
          .setValue((cfg.globalInviteUrl || '').slice(0, 256))
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.TRACKING_VIEW) {
    const cfg = await ctx.getConfig();
    const invite = cfg.globalInviteUrl?.trim();
    if (!invite) {
      await refreshPanelMessage(interaction, buildTrackingPanel(cfg));
      return true;
    }
    const detail = new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('📊 Detalhes do Tracking')
      .setDescription(
        [
          '**Convite principal** usado nas mensagens de divulgação:',
          '',
          invite,
          '',
          `**Configurado em:** ${cfg.updatedAt ? fmtDate(cfg.updatedAt) : '—'}`,
          `**Bot:** ${cfg.botRunning ? '▶️ Ligado' : '⏸ Pausado'}`
        ].join('\n')
      )
      .setTimestamp();
    await refreshPanelMessage(interaction, {
      embeds: [detail],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(PANEL.BACK)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('↩️ Voltar')
        )
      ]
    });
    return true;
  }

  if (id === PANEL.TRACKING_DEL) {
    await ctx.updateConfig({ globalInviteUrl: null });
    invalidatePanelCaches(client);
    const cfg = await ctx.getConfig();
    await refreshPanelMessage(interaction, buildTrackingPanel(cfg));
    return true;
  }

  if (id === PANEL.SCHEDULE) {
    await refreshPanelMessage(interaction, await renderScheduleView(ctx));
    return true;
  }

  if (id === PANEL.DIVULGATIONS) {
    await refreshPanelMessage(interaction, await renderDivulgationsView(ctx));
    return true;
  }

  if (id === PANEL.LOGS) {
    await refreshPanelMessage(interaction, await renderLogsView(client));
    return true;
  }

  if (id === PANEL.CYCLES) {
    await refreshPanelMessage(interaction, await renderCyclesView(ctx));
    return true;
  }

  if (id === PANEL.STOP) {
    const cfg = await ctx.getConfig();
    const next = !cfg.botRunning;
    await ctx.updateConfig({ botRunning: next });
    invalidatePanelCaches(client);
    invalidateDivulgationCache();
    if (!next) client.services.adsQueue.clearQueue();
    if (next) ctx.startCycle({ burst: true });
    else ctx.stopCycle();
    await refreshPanelMessage(interaction, await renderHome(client, { tenantId }));
    return true;
  }

  if (id === PANEL.TOKEN_ADD) {
    if (!(await requireTokenAccessForPanel(client, interaction, tenantId))) {
      await interaction.reply({
        content: '❌ Sem permissão para gerenciar tokens.',
        flags: EPHEMERAL
      });
      return true;
    }
    const modal = new ModalBuilder().setCustomId(MODAL.TOKEN_ADD).setTitle('Adicionar Token');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('token')
          .setLabel('Token da sua conta Discord')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Cole o token do usuário aqui...')
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.TOKEN_REMOVE) {
    if (!(await requireTokenAccessForPanel(client, interaction, tenantId))) {
      await interaction.reply({
        content: '❌ Sem permissão para gerenciar tokens.',
        flags: EPHEMERAL
      });
      return true;
    }
    const modal = new ModalBuilder().setCustomId(MODAL.TOKEN_REMOVE).setTitle('Remover Token');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('slot')
          .setLabel('Número do token (ex: 1)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('1')
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.SERVER_ADD) {
    const modal = new ModalBuilder().setCustomId(MODAL.SERVER_ADD).setTitle('Adicionar Servidor');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guildId')
          .setLabel('ID do Servidor')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('123456789')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('channelId')
          .setLabel('ID do Canal')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('987654321')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('delayMin')
          .setLabel(`Delay em Minutos (mínimo ${DIVULGATION.minIntervalMinutes})`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(String(DIVULGATION.minIntervalMinutes))
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('customMsg')
          .setLabel('Mensagem Personalizada (opcional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Deixe vazio para usar a mensagem global...')
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.SERVER_REMOVE) {
    const modal = new ModalBuilder().setCustomId('tn:painel:modal:server_remove').setTitle('Remover Servidor');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guildId')
          .setLabel('ID do Servidor')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.SERVER_EDIT_MSG) {
    const modal = new ModalBuilder().setCustomId('tn:painel:modal:server_msg').setTitle('Mensagem do Servidor');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guildId')
          .setLabel('ID do Servidor')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('customMsg')
          .setLabel('Mensagem personalizada (vazio = global)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.SERVER_SEND_NOW) {
    const cfg = await ctx.getConfig();
    if (!cfg.botRunning) {
      await ephemeralFollowUp(interaction, {
        content: '⚠️ Ligue o bot no painel (**Iniciar Bot**) ou envie após configurar um servidor.'
      });
      return true;
    }
    const cycle = ctx.getCycle() || ctx.startCycle();
    const send = cycle ? await cycle.sendImmediate() : { sent: 0, reason: 'Ciclo indisponível' };
    invalidatePanelCaches(client);
    const detail =
      send?.reason ||
      client.services.userTokens?.getLastError() ||
      'Nenhuma mensagem enviada.';
    const msg =
      send?.queued
        ? `⏳ **Envio enfileirado**: o ciclo atual está em andamento. Vou enviar assim que terminar.`
        : send?.sent > 0
        ? `🚀 **${send.sent}** mensagem(ns) enviada(s)! Próximos envios no intervalo configurado.`
        : `⚠️ **Falha:** ${detail}`;
    await ephemeralFollowUp(interaction, { content: msg });
    await refreshPanelMessage(interaction, await renderServersView(client, tenantId));
    return true;
  }

  if (id === PANEL.SERVER_RESET_NEXT) {
    const rows = await getPartnerServerRows(client, { force: true, tenantId });
    for (const s of rows) {
      await client.services.guildSettings.update(
        s.guildId,
        { nextSendAt: nextSendDate(s.delayMinutes) },
        tenantId
      );
    }
    invalidatePanelCaches(client);
    await refreshPanelMessage(interaction, await renderServersView(client, tenantId));
    return true;
  }

  if (id === PANEL.MSG_EDIT_GLOBAL) {
    const cfg = await ctx.getConfig();
    const modal = new ModalBuilder().setCustomId(MODAL.MSG_GLOBAL).setTitle('Editar Mensagem Global');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Digite sua mensagem de divulgação')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue((cfg.globalMessage || DEFAULT_GLOBAL_MSG).slice(0, 4000))
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.MSG_DEFAULT) {
    await ctx.updateConfig({ globalMessage: null });
    invalidatePanelCaches(client);
    await refreshPanelMessage(interaction, await renderMessageView(client, ctx, tenantId));
    return true;
  }

  if (id === PANEL.MSG_FULL) {
    const cfg = await ctx.getConfig();
    await refreshPanelMessage(interaction, buildGlobalMessageFull(cfg));
    return true;
  }

  if (id === PANEL.SCHEDULE_CREATE) {
    const modal = new ModalBuilder().setCustomId(MODAL.SCHEDULE).setTitle('Agendar Divulgação');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('datetime')
          .setLabel('Data e Hora (DD/MM/AAAA HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex: 15/02/2026 14:30')
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.SCHEDULE_CANCEL) {
    await ctx.updateConfig({ scheduledAt: null });
    invalidatePanelCaches(client);
    await refreshPanelMessage(interaction, await renderScheduleView(ctx));
    return true;
  }

  if (id === PANEL.DIV_CLEAR) {
    await ctx.divRuns.clearHistory();
    invalidateDivulgationCache();
    invalidatePanelCaches(client);
    await refreshPanelMessage(interaction, await renderDivulgationsView(ctx));
    return true;
  }

  if (id === PANEL.DIV_SELECT) {
    const modal = new ModalBuilder().setCustomId(MODAL.DIV_NUMBER).setTitle('Ver Divulgação');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('number')
          .setLabel('Número da divulgação')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('50')
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.CYCLES_EDIT) {
    const cfg = await ctx.getConfig();
    const modal = new ModalBuilder().setCustomId(MODAL.CYCLES).setTitle('Editar Ciclos');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('messagesPerCycle')
          .setLabel('Mensagens por ciclo')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.messagesPerCycle))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('delayMsg')
          .setLabel('Delay msg min-max (ex: 2-5)')
          .setStyle(TextInputStyle.Short)
          .setValue(`${cfg.delayMsgMinSec}-${cfg.delayMsgMaxSec}`)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('delayGuild')
          .setLabel('Delay servidor min-max (ex: 15-35)')
          .setStyle(TextInputStyle.Short)
          .setValue(`${cfg.delayGuildMinSec}-${cfg.delayGuildMaxSec}`)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('minCycle')
          .setLabel('Delay mínimo do ciclo (minutos)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.minCycleMinutes))
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (id === PANEL.CYCLES_RESET) {
    await ctx.updateConfig({
      messagesPerCycle: 1,
      delayMsgMinSec: 2,
      delayMsgMaxSec: 5,
      delayGuildMinSec: 15,
      delayGuildMaxSec: 35,
      minCycleMinutes: DIVULGATION.minIntervalMinutes
    });
    invalidatePanelCaches(client);
    await refreshPanelMessage(interaction, await renderCyclesView(ctx));
    return true;
  }

  await refreshPanelMessage(interaction, {
    content: '⚠️ Ação não reconhecida. Use **Atualizar** ou `/painel`.',
    embeds: [],
    components: []
  });
  return true;
  } catch (err) {
    client.logger.error({ err, customId: interaction.customId, tenantId }, 'Panel button failed');
    const msg = dbErrorMessage(err, 'Erro ao processar o painel.');
    await interaction
      .editReply({ content: `❌ ${msg}`, embeds: [], components: [] })
      .catch(() => {});
    return true;
  }
}

function parseScheduleDate(raw) {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m.map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseRange(raw, fallback) {
  const parts = String(raw).split('-').map((s) => Number(s.trim()));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n) && n > 0)) {
    return { min: Math.min(parts[0], parts[1]), max: Math.max(parts[0], parts[1]) };
  }
  return fallback;
}

async function handlePanelModal(client, interaction) {
  const id = interaction.customId;
  if (!id.startsWith(PREFIX)) return false;

  await deferModalPanel(interaction);

  const tenantId = await resolvePanelTenant(client, interaction);
  const ctx = new PanelContext(client, tenantId);
  if (!(await requirePanelAccess(client, interaction, tenantId))) return true;

  try {
  if (id === MODAL.SERVER_ADD) {
    const guildId = interaction.fields.getTextInputValue('guildId').trim();
    const channelId = interaction.fields.getTextInputValue('channelId').trim();
    const delayMin = Number(interaction.fields.getTextInputValue('delayMin'));
    const customMsg = interaction.fields.getTextInputValue('customMsg')?.trim() || null;

    if (!Number.isFinite(delayMin) || delayMin < DIVULGATION.minIntervalMinutes) {
      await interaction.editReply({
        content: `❌ Delay mínimo é **${DIVULGATION.minIntervalMinutes}** minutos (divulgação de 50 em 50 min).`,
        embeds: [],
        components: []
      });
      return true;
    }

    const access = await client.services.userTokens.validatePartnerTarget(channelId, guildId, tenantId);
    if (!access.ok) {
      await refreshPanelAfterModal(interaction, await renderServersView(client, tenantId), {
        notice: `❌ ${access.error}`
      });
      return true;
    }

    const delayMinutes = clampDelayMinutes(delayMin);
    await client.services.guildSettings.ensure(guildId, tenantId);
    await client.services.guildSettings.update(
      guildId,
      {
        adsEnabled: true,
        adsChannelId: channelId,
        partnerGuildName: access.guildName,
        delayMinutes,
        customMessage: customMsg,
        nextSendAt: null
      },
      tenantId
    );

    invalidatePanelCaches(client);
    const nome = access.guildName ? `**${access.guildName}**` : `\`${guildId}\``;

    const cycle = ctx.getCycle() || ctx.startCycle();
    const send = cycle
      ? await cycle.sendImmediate([guildId], { skipNetworkCheck: false })
      : { sent: 0, reason: 'Ciclo indisponível' };

    const settingsAfter = await client.services.guildSettings.get(guildId, tenantId);
    const nextLabel = settingsAfter?.nextSendAt
      ? fmtDate(settingsAfter.nextSendAt)
      : nextSendDate(delayMinutes).toLocaleString('pt-BR');

    const lines = [
      `✅ Servidor ${nome} configurado.`,
      `📬 Envio pela **sua conta** (token #${access.tokenSlot}).`
    ];

    if (send?.sent > 0) {
      lines.push(`🚀 **${send.sent}** mensagem enviada agora no canal!`);
      if (send.errors) lines.push(`⚠️ ${send.errors} erro(s) em outros destinos.`);
    } else {
      const err =
        send?.reason ||
        client.services.userTokens?.getLastError() ||
        'Confira token, `/rede` ligada e permissão no canal.';
      lines.push(`⚠️ Não enviou agora: ${err}`);
    }

    lines.push(`⏱ Próximo envio automático: **${nextLabel}** (a cada **${delayMinutes}** min).`);

    await refreshPanelAfterModal(interaction, await renderServersView(client, tenantId), {
      notice: lines.join('\n')
    });
    return true;
  }

  if (id === 'tn:painel:modal:server_remove') {
    const guildId = interaction.fields.getTextInputValue('guildId').trim();
    await client.services.guildSettings.update(
      guildId,
      { adsChannelId: null, customMessage: null, nextSendAt: null },
      tenantId
    );
    invalidatePanelCaches(client);
    await refreshPanelAfterModal(interaction, await renderServersView(client, tenantId), {
      notice: '✅ Canal de divulgação removido.'
    });
    return true;
  }

  if (id === 'tn:painel:modal:server_msg') {
    const guildId = interaction.fields.getTextInputValue('guildId').trim();
    const customMsg = interaction.fields.getTextInputValue('customMsg')?.trim() || null;
    await client.services.guildSettings.update(guildId, { customMessage: customMsg }, tenantId);
    invalidatePanelCaches(client);
    await refreshPanelAfterModal(interaction, await renderServersView(client, tenantId), {
      notice: '✅ Mensagem do servidor atualizada.'
    });
    return true;
  }

  if (id === MODAL.MSG_GLOBAL) {
    const message = interaction.fields.getTextInputValue('message');
    await ctx.updateConfig({ globalMessage: message });
    invalidatePanelCaches(client);
    await refreshPanelAfterModal(interaction, await renderMessageView(client, ctx, tenantId), {
      notice: '✅ Mensagem global salva.'
    });
    return true;
  }

  if (id === MODAL.TRACKING_ADD) {
    const inviteUrl = interaction.fields.getTextInputValue('inviteUrl').trim();
    if (!/^https?:\/\//i.test(inviteUrl) && !inviteUrl.includes('discord.gg')) {
      await interaction.editReply({
        content: '❌ Informe um link válido (ex: `https://discord.gg/seu-servidor`).',
        embeds: [],
        components: []
      });
      return true;
    }
    await ctx.updateConfig({ globalInviteUrl: inviteUrl });
    invalidatePanelCaches(client);
    const cfg = await ctx.getConfig();
    await refreshPanelAfterModal(interaction, buildTrackingPanel(cfg), {
      notice: '✅ Convite de tracking salvo.'
    });
    return true;
  }

  if (id === MODAL.SCHEDULE) {
    const dt = parseScheduleDate(interaction.fields.getTextInputValue('datetime'));
    if (!dt || dt.getTime() <= Date.now()) {
      await interaction.editReply({
        content: '❌ Data/hora inválida ou no passado.',
        embeds: [],
        components: []
      });
      return true;
    }
    await ctx.updateConfig({ scheduledAt: dt });
    invalidatePanelCaches(client);
    await refreshPanelAfterModal(interaction, await renderScheduleView(ctx), {
      notice: `✅ Agendado para ${fmtDate(dt)}`
    });
    return true;
  }

  if (id === MODAL.CYCLES) {
    const messagesPerCycle = Math.max(1, Number(interaction.fields.getTextInputValue('messagesPerCycle')) || 1);
    const msgR = parseRange(interaction.fields.getTextInputValue('delayMsg'), { min: 2, max: 5 });
    const guildR = parseRange(interaction.fields.getTextInputValue('delayGuild'), { min: 15, max: 35 });
    const rawMin = Number(interaction.fields.getTextInputValue('minCycle'));
    const minCycleMinutes = clampDelayMinutes(
      Number.isFinite(rawMin) ? rawMin : DIVULGATION.minIntervalMinutes
    );

    await ctx.updateConfig({
      messagesPerCycle,
      delayMsgMinSec: msgR.min,
      delayMsgMaxSec: msgR.max,
      delayGuildMinSec: guildR.min,
      delayGuildMaxSec: guildR.max,
      minCycleMinutes
    });
    invalidatePanelCaches(client);

    let cycleMsg = '✅ Configuração de ciclos salva.';
    if (Number.isFinite(rawMin) && rawMin < DIVULGATION.minIntervalMinutes) {
      cycleMsg += ` Intervalo mínimo: **${DIVULGATION.minIntervalMinutes}** min (50 em 50).`;
    }
    await refreshPanelAfterModal(interaction, await renderCyclesView(ctx), { notice: cycleMsg });
    return true;
  }

  if (id === MODAL.DIV_NUMBER) {
    const num = Number(interaction.fields.getTextInputValue('number'));
    const run = await ctx.divRuns.getByNumber(num);
    if (!run) {
      await refreshPanelAfterModal(interaction, await renderDivulgationsView(ctx), {
        notice: '❌ Divulgação não encontrada.'
      });
      return true;
    }
    await refreshPanelAfterModal(interaction, buildDivulgationDetail(run, run.status === 'running'));
    return true;
  }

  if (id === MODAL.TOKEN_ADD) {
    if (!(await requireTokenAccessForPanel(client, interaction, tenantId))) {
      await interaction.editReply({ content: '❌ Sem permissão.', embeds: [], components: [] });
      return true;
    }
    try {
      const raw = interaction.fields.getTextInputValue('token');
      const result = await client.services.userTokens.addToken({
        rawToken: raw,
        ownerId: interaction.user.id,
        tenantId
      });
      invalidatePanelCaches(client);
      const label = result.updated ? 'atualizado' : 'adicionado';
      await refreshPanelAfterModal(interaction, await renderTokensView(client, tenantId), {
        notice: `✅ Token **#${result.slot}** ${label} — conta **${result.profile.globalName || result.profile.username}**`
      });
    } catch (err) {
      await refreshPanelAfterModal(interaction, await renderTokensView(client, tenantId), {
        notice: `❌ ${err.message}`
      });
    }
    return true;
  }

  if (id === MODAL.TOKEN_REMOVE) {
    if (!(await requireTokenAccessForPanel(client, interaction, tenantId))) {
      await interaction.editReply({ content: '❌ Sem permissão.', embeds: [], components: [] });
      return true;
    }
    const slot = interaction.fields.getTextInputValue('slot');
    const ok = await client.services.userTokens.removeBySlot(slot, tenantId);
    invalidatePanelCaches(client);
    await refreshPanelAfterModal(interaction, await renderTokensView(client, tenantId), {
      notice: ok ? `✅ Token **#${slot}** removido.` : `❌ Token **#${slot}** não encontrado.`
    });
    return true;
  }

  await interaction.editReply({
    content: '⚠️ Modal não reconhecido. Use `/painel` → **Atualizar**.',
    embeds: [],
    components: []
  });
  return true;
  } catch (err) {
    client.logger.error({ err, customId: id, tenantId }, 'Panel modal failed');
    const msg = dbErrorMessage(err, 'Erro ao salvar.');
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ ${msg}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ ${msg}`, flags: EPHEMERAL }).catch(() => {});
    }
    return true;
  }
}

module.exports = { handlePanelInteraction, handlePanelModal, renderHome, isPanelInteraction };
