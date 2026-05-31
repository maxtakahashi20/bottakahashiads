const { isPlatformOwner, MSG_PLATFORM_ACCESS_DENIED } = require('../../utils/permissions');
const { deferEphemeral } = require('../../utils/interaction');
const { DM_BROADCAST } = require('../../config/constants');
const {
  validateDmBroadcastInput,
  checkDmBroadcastCooldown,
  setDmBroadcastCooldown,
  clearDmBroadcastCooldown,
  dmBroadcastGuildCooldownKey,
  dmBroadcastFriendsCooldownKey
} = require('../../utils/dmBroadcast');
const {
  startCampaign,
  endCampaign,
  shouldAbortCampaign
} = require('./dmCampaignRegistry');
const { MODAL_IDS, isDmBroadcastModalId } = require('./dmBroadcastModal');
const { deliverPlainTextToFriends } = require('./friendsDmService');
const { deliverPlainTextToGuildMembersViaUser } = require('./guildDmService');
const { validateUserToken } = require('../tokens/userTokenApi');
const { buildCampaignReport, sendCampaignReportDm } = require('./dmCampaignReport');
const { formatCaughtError, userFacingError } = require('../../utils/discordErrors');

function formatRetry(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m}min`;
}

function formatProgressLine({ sent, failed, dmClosed, skipped = 0, processed, total }) {
  return `📊 **${processed}/${total}** · ✅ **${sent}** · ⏭️ **${skipped}** (já tinham) · 🔒 **${dmClosed}** · ❌ **${failed}**`;
}

/**
 * @param {import('../../structures/ExtendedClient').ExtendedClient} client
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleDmBroadcastModal(client, interaction) {
  const customId = interaction.customId;
  if (!isDmBroadcastModalId(customId)) return false;

  await deferEphemeral(interaction);

  if (!isPlatformOwner(interaction)) {
    await interaction.editReply({
      content: userFacingError(MSG_PLATFORM_ACCESS_DENIED, { title: 'Acesso negado' })
    });
    return true;
  }

  const isFriends = customId === MODAL_IDS.friends;
  const isGuild = customId === MODAL_IDS.guild;

  const raw = {
    token: interaction.fields.getTextInputValue('token'),
    intervalo: interaction.fields.getTextInputValue('intervalo'),
    mensagem: interaction.fields.getTextInputValue('mensagem')
  };
  if (isGuild) {
    raw.servidor_id = interaction.fields.getTextInputValue('servidor_id');
  }

  const v = validateDmBroadcastInput(raw, {
    requireGuildId: isGuild,
    requireToken: true
  });
  if (!v.ok) {
    await interaction.editReply({
      content: userFacingError(v.error, { title: 'Dados do formulário inválidos' })
    });
    return true;
  }

  const { delaySec, mensagem, guildId, token } = v.data;
  const delayMs = delaySec * 1000;
  const ownerId = interaction.user.id;

  let profile;
  try {
    profile = await validateUserToken(token);
  } catch (err) {
    await interaction.editReply({
      content: userFacingError(formatCaughtError(err, 'token_validate'), {
        title: 'TOKEN recusado'
      })
    });
    return true;
  }

  const accountLabel = profile.globalName || profile.username;
  const profileId = profile.id;

  await client.services.blacklist.warm();
  const userBlocked = await client.services.blacklist.isBlacklisted('user', ownerId);
  if (userBlocked) {
    await interaction.editReply({
      content: userFacingError(
        'Seu usuário consta na lista de bloqueio da plataforma.',
        { title: 'Operação bloqueada' }
      )
    });
    return true;
  }

  if (isFriends) {
    const cdKey = dmBroadcastFriendsCooldownKey(ownerId);
    const dmCd = checkDmBroadcastCooldown(client, cdKey);
    if (!dmCd.ok) {
      await interaction.editReply({
        content: userFacingError(
          `Campanha para amigos em intervalo de espera (${formatRetry(dmCd.retryAfterMs)} restantes). Utilize /finalizar-campanha para liberar antes do prazo.`,
          { title: 'Cooldown ativo' }
        )
      });
      return true;
    }

    setDmBroadcastCooldown(client, cdKey);
    startCampaign(ownerId, { type: 'friends' });

    await interaction.editReply({
      content: [
        `📨 **DM para amigos** (${accountLabel})…`,
        `⏱️ Intervalo: **${delaySec}s**`,
        '👥 Carregando lista de amigos…',
        '_Para parar: `/finalizar-campanha`_'
      ].join('\n')
    });

    let result;
    try {
      result = await deliverPlainTextToFriends({
        userToken: token,
        accountUserId: profileId,
        content: mensagem,
        delayMs,
        shouldAbort: () => shouldAbortCampaign(ownerId),
        onProgress: async (stats) => {
          try {
            await interaction.editReply({
              content: [
                `📨 **Amigos** (${accountLabel})`,
                formatProgressLine(stats),
                '_Antflood: não reenvia se o link já está na DM · `/finalizar-campanha` para parar_'
              ].join('\n')
            });
          } catch (_) {}
        }
      });
    } finally {
      endCampaign(ownerId);
    }

    if (result.aborted) clearDmBroadcastCooldown(client, cdKey);

    const reportParts = buildCampaignReport({
      type: 'friends',
      result,
      accountLabel,
      delaySec,
      aborted: result.aborted,
      fatalError: result.fatalError,
      notice: result.notice
    });
    const reportDm = await sendCampaignReportDm(client, ownerId, reportParts);

    if (result.fatalError) {
      await interaction.editReply({
        content: [
          userFacingError(result.fatalError, { title: 'Campanha não iniciada' }),
          reportDm.ok
            ? 'Relatório registrado na sua DM.'
            : userFacingError(reportDm.error, { title: 'Relatório na DM não entregue' })
        ].join('\n\n')
      });
      return true;
    }

    await finishFriendsReply(interaction, result, delaySec, result.notice, result.aborted, reportDm);
    logDm(client, 'dm_broadcast_friends', interaction, ownerId, result, delaySec);
    return true;
  }

  const guildBlocked = await client.services.blacklist.isBlacklisted('guild', guildId);
  if (guildBlocked) {
    await interaction.editReply({
      content: userFacingError('O servidor informado está bloqueado na plataforma.', {
        title: 'Servidor bloqueado'
      })
    });
    return true;
  }

  const cdKey = dmBroadcastGuildCooldownKey(guildId);
  const dmCd = checkDmBroadcastCooldown(client, cdKey);
  if (!dmCd.ok) {
    await interaction.editReply({
      content: userFacingError(
        `Campanha neste servidor em intervalo de espera (${formatRetry(dmCd.retryAfterMs)} restantes). Utilize /finalizar-campanha para liberar antes do prazo.`,
        { title: 'Cooldown ativo' }
      )
    });
    return true;
  }

  setDmBroadcastCooldown(client, cdKey);
  startCampaign(ownerId, { type: 'guild', guildId });

  await interaction.editReply({
    content: [
      `📨 **DM no servidor** (${accountLabel})…`,
      `🏠 ID: \`${guildId}\``,
      `⏱️ Intervalo: **${delaySec}s**`,
      '👥 Listando membros (mensagem direta; se falhar → pedido de amizade + mensagem)…',
      '_Para parar: `/finalizar-campanha`_'
    ].join('\n')
  });

  let result;
  try {
    result = await deliverPlainTextToGuildMembersViaUser({
      client,
      userToken: token,
      guildId,
      accountUserId: profileId,
      content: mensagem,
      delayMs,
      shouldAbort: () => shouldAbortCampaign(ownerId),
      onProgress: async (stats) => {
        try {
          await interaction.editReply({
            content: [
              `📨 **Servidor** \`${guildId}\` (${accountLabel})`,
              formatProgressLine(stats),
              '_Mensagem direta; se falhar → pedido de amizade + mensagem · `/finalizar-campanha` para parar_'
            ].join('\n')
          });
        } catch (_) {}
      }
    });
  } finally {
    endCampaign(ownerId);
  }

  if (result.aborted) clearDmBroadcastCooldown(client, cdKey);

  const guildName = result.guildName || guildId;

  if (result.fatalError) {
    const errReport = buildCampaignReport({
      type: 'guild',
      result,
      accountLabel,
      delaySec,
      fatalError: result.fatalError,
      guildId,
      guildName
    });
    const errReportDm = await sendCampaignReportDm(client, ownerId, errReport);
    await interaction.editReply({
      content: [
        userFacingError(result.fatalError, { title: 'Campanha no servidor não concluída' }),
        'Verifique TOKEN, ID DISCORD e se a conta do token participa do servidor.',
        errReportDm.ok
          ? 'Relatório registrado na sua DM.'
          : userFacingError(errReportDm.error, { title: 'Relatório na DM não entregue' })
      ].join('\n\n')
    });
    return true;
  }

  const estMinutes = Math.ceil((result.members * delaySec) / 60);

  const reportParts = buildCampaignReport({
    type: 'guild',
    result,
    accountLabel,
    delaySec,
    aborted: result.aborted,
    notice: result.notice,
    guildId,
    guildName
  });
  const reportDm = await sendCampaignReportDm(client, ownerId, reportParts);

  await interaction.editReply({
    content: [
      result.aborted ? '🛑 **Campanha no servidor interrompida**' : '✅ **Campanha no servidor concluída**',
      `🏠 **${guildName}** (\`${guildId}\`)`,
      `👥 Membros: **${result.members}**`,
      `✅ Enviadas: **${result.ok}**`,
      result.friendRequestRetries
        ? `🔄 Etapa extra (amizade + msg): **${result.friendRequestRetries}**`
        : null,
      `⏭️ Já tinham (antflood): **${result.skipped || 0}**`,
      `🔒 DM fechada: **${result.dmClosed}**`,
      `❌ Outras falhas: **${result.fail}**`,
      `⏱️ Intervalo: **${delaySec}s** (~${estMinutes} min)`,
      result.aborted ? '🔄 Cooldown liberado — pode enviar de novo.' : '',
      result.aborted ? '' : '_Quem bloqueou DM não recebe._',
      result.aborted
        ? null
        : `Próximo envio neste servidor em **${Math.round(DM_BROADCAST.guildCooldownSec / 60)} min**.`,
      reportDm.ok
        ? 'Relatório detalhado enviado na sua DM.'
        : userFacingError(
            `${reportDm.error} Ative mensagens diretas do bot Takahashi Ads.`,
            { title: 'Relatório na DM não entregue' }
          )
    ]
      .filter((line) => line != null && line !== '')
      .join('\n')
  });

  client.services.logs
    .write('dm_broadcast_guild', {
      guildId,
      userId: ownerId,
      message: `DM servidor ${guildName}: ${result.ok} ok`,
      meta: {
        delaySec,
        members: result.members,
        ok: result.ok,
        dmClosed: result.dmClosed,
        fail: result.fail,
        accountId: profileId
      }
    })
    .catch(() => {});

  return true;
}

async function finishFriendsReply(interaction, result, delaySec, notice = null, aborted = false, reportDm = null) {
  const estMinutes = Math.ceil((result.members * delaySec) / 60);
  await interaction.editReply({
    content: [
      aborted ? '🛑 **Campanha para amigos interrompida**' : '✅ **Campanha para amigos concluída**',
      notice ? `ℹ️ ${notice}` : null,
      `👥 Destinatários: **${result.members}**`,
      `✅ Enviadas: **${result.ok}**`,
      `⏭️ Já tinham (antflood): **${result.skipped || 0}**`,
      `🔒 DM fechada: **${result.dmClosed}**`,
      `❌ Outras falhas: **${result.fail}**`,
      `⏱️ Intervalo: **${delaySec}s** (~${estMinutes} min)`,
      aborted ? '🔄 Cooldown liberado — pode enviar de novo.' : '',
      aborted ? null : `Próximo envio para amigos em **${Math.round(DM_BROADCAST.guildCooldownSec / 60)} min**.`,
      reportDm?.ok
        ? 'Relatório detalhado enviado na sua DM (entregues, não entregues e motivos).'
        : reportDm
          ? userFacingError(
              `${reportDm.error} Ative mensagens diretas do bot Takahashi Ads.`,
              { title: 'Relatório na DM não entregue' }
            )
          : null
    ]
      .filter((line) => line != null && line !== '')
      .join('\n')
  });
}

function logDm(client, type, interaction, ownerId, result, delaySec) {
  client.services.logs
    .write(type, {
      guildId: interaction.guildId,
      userId: ownerId,
      message: `DM: ${result.ok} ok`,
      meta: { delaySec, members: result.members, ok: result.ok, fail: result.fail }
    })
    .catch(() => {});
}

function isDmBroadcastModal(customId) {
  return isDmBroadcastModalId(customId);
}

module.exports = { handleDmBroadcastModal, isDmBroadcastModal };
