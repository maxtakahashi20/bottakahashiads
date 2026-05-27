const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
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
const { deferComponent, deferEphemeral } = require('../../utils/interaction');
const { fmtDate } = require('./panelFormat');
const { DIVULGATION } = require('../../config/constants');
const { clampDelayMinutes, nextSendDate } = require('../../utils/divulgationLimits');
const {
  getViewCache,
  setViewCache,
  getPartnerServerRows,
  invalidatePanelCaches
} = require('./panelCache');
const { invalidateDivulgationCache } = require('./panelStats');

function isPanelInteraction(interaction) {
  const id = interaction.customId || '';
  return id.startsWith(PREFIX);
}

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
      await interaction.reply({ ...payload, ephemeral: true });
    }
    return false;
  }
  return true;
}

async function requireTokenOwner(interaction) {
  if (!isTokenOwner(interaction)) {
    await interaction.reply({
      content: '❌ Só o dono da rede (`BOT_OWNER_IDS`) pode gerenciar tokens de usuário.',
      ephemeral: true
    });
    return false;
  }
  return true;
}

async function renderHome(client, { force = false } = {}) {
  let payload = !force ? getViewCache(client, 'home') : null;
  if (!payload) {
    const stats = await collectPanelStats(client, { force });
    payload = buildHomePanel(stats);
    setViewCache(client, 'home', payload);
  }
  return payload;
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
  PANEL.TOKEN_REMOVE
]);

async function handlePanelInteraction(client, interaction) {
  if (!isPanelInteraction(interaction)) return false;
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;

  const opensModal = interaction.isButton() && MODAL_BUTTONS.has(interaction.customId);
  if (!opensModal) {
    await deferComponent(interaction);
  }

  if (!(await requireAdmin(interaction))) return true;

  const systemConfig = new SystemConfigService();
  const divRuns = new DivulgationRunService();
  const forceRefresh = interaction.isButton() && interaction.customId === PANEL.REFRESH;

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${PANEL.DIV_SELECT}:menu`)) {
    const val = interaction.values[0];
    const current = await divRuns.getCurrent();
    if (val === 'current' && current) {
      await interaction.editReply(buildDivulgationDetail(current, true));
      return true;
    }
    const run = await divRuns.getByNumber(Number(val));
    if (run) await interaction.editReply(buildDivulgationDetail(run, run.status === 'running'));
    else await interaction.editReply(await renderHome(client));
    return true;
  }

  if (!interaction.isButton()) return false;

  const id = interaction.customId;

  if (id === PANEL.BACK || id === PANEL.REFRESH || id === PANEL.HOME) {
    let payload = !forceRefresh ? getViewCache(client, 'home') : null;
    if (!payload) {
      const stats = await collectPanelStats(client, { force: forceRefresh });
      payload = buildHomePanel(stats);
      setViewCache(client, 'home', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.TOKENS) {
    let payload = getViewCache(client, 'tokens');
    if (!payload) {
      const rows = await client.services.userTokens.listForPanel();
      payload = buildTokensPanel(rows);
      setViewCache(client, 'tokens', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.SERVERS) {
    let payload = getViewCache(client, 'servers');
    if (!payload) {
      const rows = await getPartnerServerRows(client);
      payload = buildServersPanel(client, rows);
      setViewCache(client, 'servers', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.MESSAGE) {
    let payload = getViewCache(client, 'message');
    if (!payload) {
      const [cfg, stats] = await Promise.all([
        systemConfig.get(),
        collectPanelStats(client)
      ]);
      payload = buildMessagePanel(cfg, stats.configuredServers);
      setViewCache(client, 'message', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.TRACKING) {
    await interaction.editReply(buildTrackingPanel());
    return true;
  }

  if (id === PANEL.SCHEDULE) {
    let payload = getViewCache(client, 'schedule');
    if (!payload) {
      const cfg = await systemConfig.get();
      payload = buildSchedulePanel(cfg);
      setViewCache(client, 'schedule', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.DIVULGATIONS) {
    let payload = getViewCache(client, 'divulgations');
    if (!payload) {
      const [runs, current] = await Promise.all([
        divRuns.listRecent(10),
        divRuns.getCurrent()
      ]);
      payload = buildDivulgationsListPanel(runs, current);
      setViewCache(client, 'divulgations', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.LOGS) {
    let payload = getViewCache(client, 'logs');
    if (!payload) {
      const events = await client.prisma.logEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15
      });
      payload = buildLogsPanel(events);
      setViewCache(client, 'logs', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.CYCLES) {
    let payload = getViewCache(client, 'cycles');
    if (!payload) {
      const cfg = await systemConfig.get();
      payload = buildCyclesPanel(cfg);
      setViewCache(client, 'cycles', payload);
    }
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.STOP) {
    const cfg = await systemConfig.get();
    const next = !cfg.botRunning;
    await systemConfig.update({ botRunning: next });
    invalidatePanelCaches(client);
    invalidateDivulgationCache();
    if (!next) client.services.adsQueue.clearQueue();
    if (client.services.divulgationCycle) {
      if (next) client.services.divulgationCycle.start({ burst: true });
      else client.services.divulgationCycle.stop();
    }
    const stats = await collectPanelStats(client, { force: true });
    const payload = buildHomePanel(stats);
    setViewCache(client, 'home', payload);
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.TOKEN_ADD) {
    if (!(await requireTokenOwner(interaction))) return true;
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
    if (!(await requireTokenOwner(interaction))) return true;
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
    const cfg = await systemConfig.get();
    if (!cfg.botRunning) {
      await interaction.followUp({
        content: '⚠️ Ligue o bot no painel (**Iniciar Bot**) ou envie após configurar um servidor.',
        ephemeral: true
      });
      return true;
    }
    const send = await client.services.divulgationCycle.sendImmediate();
    invalidatePanelCaches(client);
    const detail =
      send?.reason ||
      client.services.userTokens?.getLastError() ||
      'Nenhuma mensagem enviada.';
    const msg =
      send?.sent > 0
        ? `🚀 **${send.sent}** mensagem(ns) enviada(s)! Próximos envios no intervalo configurado.`
        : `⚠️ **Falha:** ${detail}`;
    await interaction.followUp({ content: msg, ephemeral: true });
    const rows = await getPartnerServerRows(client, { force: true });
    const payload = buildServersPanel(client, rows);
    setViewCache(client, 'servers', payload);
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.SERVER_RESET_NEXT) {
    const rows = await getPartnerServerRows(client);
    for (const s of rows) {
      await client.services.guildSettings.update(s.guildId, {
        nextSendAt: nextSendDate(s.delayMinutes)
      });
    }
    invalidatePanelCaches(client);
    const fresh = await getPartnerServerRows(client, { force: true });
    const payload = buildServersPanel(client, fresh);
    setViewCache(client, 'servers', payload);
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.MSG_EDIT_GLOBAL) {
    const cfg = await systemConfig.get();
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
    await systemConfig.update({ globalMessage: null });
    invalidatePanelCaches(client);
    const cfg = await systemConfig.get();
    const stats = await collectPanelStats(client, { force: true });
    const payload = buildMessagePanel(cfg, stats.configuredServers);
    setViewCache(client, 'message', payload);
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.MSG_FULL) {
    const cfg = await systemConfig.get();
    await interaction.editReply(buildGlobalMessageFull(cfg));
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
    await systemConfig.update({ scheduledAt: null });
    invalidatePanelCaches(client);
    const cfg = await systemConfig.get();
    const payload = buildSchedulePanel(cfg);
    setViewCache(client, 'schedule', payload);
    await interaction.editReply(payload);
    return true;
  }

  if (id === PANEL.DIV_CLEAR) {
    await divRuns.clearHistory();
    invalidateDivulgationCache();
    invalidatePanelCaches(client);
    const [runs, current] = await Promise.all([
      divRuns.listRecent(10),
      divRuns.getCurrent()
    ]);
    const payload = buildDivulgationsListPanel(runs, current);
    setViewCache(client, 'divulgations', payload);
    await interaction.editReply(payload);
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
    const cfg = await systemConfig.get();
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
    await systemConfig.update({
      messagesPerCycle: 1,
      delayMsgMinSec: 2,
      delayMsgMaxSec: 5,
      delayGuildMinSec: 15,
      delayGuildMaxSec: 35,
      minCycleMinutes: DIVULGATION.minIntervalMinutes
    });
    invalidatePanelCaches(client);
    const cfg = await systemConfig.get();
    const payload = buildCyclesPanel(cfg);
    setViewCache(client, 'cycles', payload);
    await interaction.editReply(payload);
    return true;
  }

  return false;
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
  if (!(await requireAdmin(interaction))) return true;

  const systemConfig = new SystemConfigService();
  const divRuns = new DivulgationRunService();

  if (id === MODAL.SERVER_ADD) {
    const guildId = interaction.fields.getTextInputValue('guildId').trim();
    const channelId = interaction.fields.getTextInputValue('channelId').trim();
    const delayMin = Number(interaction.fields.getTextInputValue('delayMin'));
    const customMsg = interaction.fields.getTextInputValue('customMsg')?.trim() || null;

    if (!Number.isFinite(delayMin) || delayMin < DIVULGATION.minIntervalMinutes) {
      await interaction.reply({
        content: `❌ Delay mínimo é **${DIVULGATION.minIntervalMinutes}** minutos (divulgação de 50 em 50 min).`,
        ephemeral: true
      });
      return true;
    }

    await deferEphemeral(interaction);

    const access = await client.services.userTokens.validatePartnerTarget(channelId, guildId);
    if (!access.ok) {
      await interaction.editReply({ content: `❌ ${access.error}` });
      return true;
    }

    const delayMinutes = clampDelayMinutes(delayMin);
    await client.services.guildSettings.ensure(guildId);
    await client.services.guildSettings.update(guildId, {
      adsEnabled: true,
      adsChannelId: channelId,
      partnerGuildName: access.guildName,
      delayMinutes,
      customMessage: customMsg,
      nextSendAt: null
    });

    invalidatePanelCaches(client);
    const nome = access.guildName ? `**${access.guildName}**` : `\`${guildId}\``;

    const send = await client.services.divulgationCycle.sendImmediate([guildId], {
      skipNetworkCheck: false
    });

    const settingsAfter = await client.services.guildSettings.get(guildId);
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

    await interaction.editReply({ content: lines.join('\n') });
    return true;
  }

  if (id === 'tn:painel:modal:server_remove') {
    const guildId = interaction.fields.getTextInputValue('guildId').trim();
    await client.services.guildSettings.update(guildId, {
      adsChannelId: null,
      customMessage: null,
      nextSendAt: null
    });
    invalidatePanelCaches(client);
    await interaction.reply({ content: '✅ Canal de divulgação removido.', ephemeral: true });
    return true;
  }

  if (id === 'tn:painel:modal:server_msg') {
    const guildId = interaction.fields.getTextInputValue('guildId').trim();
    const customMsg = interaction.fields.getTextInputValue('customMsg')?.trim() || null;
    await client.services.guildSettings.update(guildId, { customMessage: customMsg });
    invalidatePanelCaches(client);
    await interaction.reply({ content: '✅ Mensagem do servidor atualizada.', ephemeral: true });
    return true;
  }

  if (id === MODAL.MSG_GLOBAL) {
    const message = interaction.fields.getTextInputValue('message');
    await systemConfig.update({ globalMessage: message });
    invalidatePanelCaches(client);
    await interaction.reply({ content: '✅ Mensagem global salva.', ephemeral: true });
    return true;
  }

  if (id === MODAL.SCHEDULE) {
    const dt = parseScheduleDate(interaction.fields.getTextInputValue('datetime'));
    if (!dt || dt.getTime() <= Date.now()) {
      await interaction.reply({ content: '❌ Data/hora inválida ou no passado.', ephemeral: true });
      return true;
    }
    await systemConfig.update({ scheduledAt: dt });
    invalidatePanelCaches(client);
    await interaction.reply({ content: `✅ Agendado para ${fmtDate(dt)}`, ephemeral: true });
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

    await systemConfig.update({
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
    await interaction.reply({ content: cycleMsg, ephemeral: true });
    return true;
  }

  if (id === MODAL.DIV_NUMBER) {
    const num = Number(interaction.fields.getTextInputValue('number'));
    const run = await divRuns.getByNumber(num);
    if (!run) {
      await interaction.reply({ content: '❌ Divulgação não encontrada.', ephemeral: true });
      return true;
    }
    const payload = buildDivulgationDetail(run, run.status === 'running');
    await interaction.reply({ ...payload, ephemeral: true });
    return true;
  }

  if (id === MODAL.TOKEN_ADD) {
    if (!(await requireTokenOwner(interaction))) return true;
    await deferEphemeral(interaction);
    try {
      const raw = interaction.fields.getTextInputValue('token');
      const result = await client.services.userTokens.addToken({
        rawToken: raw,
        ownerId: interaction.user.id
      });
      invalidatePanelCaches(client);
      const label = result.updated ? 'atualizado' : 'adicionado';
      await interaction.editReply({
        content: `✅ Token **#${result.slot}** ${label} — conta **${result.profile.globalName || result.profile.username}**`
      });
    } catch (err) {
      await interaction.editReply({ content: `❌ ${err.message}` });
    }
    return true;
  }

  if (id === MODAL.TOKEN_REMOVE) {
    if (!(await requireTokenOwner(interaction))) return true;
    await deferEphemeral(interaction);
    const slot = interaction.fields.getTextInputValue('slot');
    const ok = await client.services.userTokens.removeBySlot(slot);
    invalidatePanelCaches(client);
    await interaction.editReply({
      content: ok ? `✅ Token **#${slot}** removido.` : `❌ Token **#${slot}** não encontrado.`
    });
    return true;
  }

  return false;
}

module.exports = { handlePanelInteraction, handlePanelModal, renderHome, isPanelInteraction };
