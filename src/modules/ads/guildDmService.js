const { setTimeout: delay } = require('timers/promises');
const { sendDmAsUser, sendFriendRequestThenMessage } = require('../tokens/userTokenApi');
const { resolveGuildMemberIds } = require('./guildMemberList');
const { DM_BROADCAST } = require('../../config/constants');
const { isRateLimitResult, applyUserDmSendResult } = require('./dmSendResult');

function shouldRetryWithFriendRequest(result) {
  if (!result || result.ok || result.skipped) return false;
  if (isRateLimitResult(result)) return false;
  return true;
}

/**
 * Mensagem direta; se falhar → pedido de amizade + mensagem.
 */
async function sendGuildDmToMember({ userId, userToken, content, accountUserId }) {
  let result = await sendDmAsUser(userId, userToken, content, accountUserId);

  if (isRateLimitResult(result) && !result.skipped) {
    const waitMs = (result.retryAfterSec ?? 60) * 1000;
    await delay(waitMs);
    result = await sendDmAsUser(userId, userToken, content, accountUserId);
  }

  if (!shouldRetryWithFriendRequest(result)) {
    return result;
  }

  const retry = await sendFriendRequestThenMessage(
    userId,
    userToken,
    content,
    accountUserId
  );

  return {
    ...retry,
    firstAttemptError: result.error || null
  };
}

/**
 * DM para membros do servidor (token de usuário).
 */
async function deliverPlainTextToGuildMembersViaUser({
  client,
  userToken,
  guildId,
  accountUserId,
  content,
  delayMs,
  onProgress,
  shouldAbort
}) {
  const membersRes = await resolveGuildMemberIds({ client, guildId, userToken });
  if (!membersRes.ok) {
    return {
      ok: 0,
      fail: 0,
      dmClosed: 0,
      skipped: 0,
      friendRequestsSent: 0,
      friendRequestRetries: 0,
      members: 0,
      deliveries: [],
      fatalError: membersRes.error,
      guildName: membersRes.guildName || null
    };
  }

  const notices = [membersRes.notice].filter(Boolean);
  notices.push(
    'Fluxo: **mensagem no privado**. Se não der certo → **pedido de amizade** e, em seguida, a mensagem de novo.'
  );

  let memberIds = membersRes.memberIds;
  if (accountUserId) {
    memberIds = memberIds.filter((id) => id !== accountUserId);
  }

  const stats = {
    sent: 0,
    fail: 0,
    dmClosed: 0,
    skipped: 0,
    friendRequestsSent: 0,
    friendRequestRetries: 0
  };
  const deliveries = [];
  const total = memberIds.length;
  let aborted = false;

  for (let i = 0; i < memberIds.length; i += 1) {
    if (shouldAbort?.()) {
      aborted = true;
      break;
    }

    const userId = memberIds[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await sendGuildDmToMember({
      userId,
      userToken,
      content,
      accountUserId
    });

    if (result.usedFriendFallback) stats.friendRequestRetries += 1;
    if (result.friendRequestSent) stats.friendRequestsSent += 1;

    const { status, error } = applyUserDmSendResult(result, stats);

    let detailError = result.skipped ? result.reason || error : error;
    if (result.usedFriendFallback) {
      if (status === 'sent') {
        detailError = 'Mensagem direta falhou; entregue após pedido de amizade + mensagem.';
      } else if (detailError) {
        detailError = `Mensagem direta falhou (${result.firstAttemptError || 'erro'}). Pedido de amizade + mensagem: ${detailError}`;
      }
    }

    deliveries.push({
      userId,
      status,
      error: detailError,
      friendRequestSent: !!result.friendRequestSent,
      usedFriendFallback: !!result.usedFriendFallback
    });

    const processed = i + 1;
    if (
      onProgress &&
      (processed % DM_BROADCAST.progressUpdateEvery === 0 || processed === total)
    ) {
      // eslint-disable-next-line no-await-in-loop
      await onProgress({ ...stats, failed: stats.fail, total, processed });
    }

    if (i < memberIds.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await delay(delayMs);
    }
  }

  return {
    ok: stats.sent,
    fail: stats.fail,
    dmClosed: stats.dmClosed,
    skipped: stats.skipped,
    friendRequestsSent: stats.friendRequestsSent,
    friendRequestRetries: stats.friendRequestRetries,
    members: total,
    deliveries,
    fatalError: null,
    guildName: membersRes.guildName || null,
    notice: notices.filter(Boolean).join('\n'),
    aborted,
    processed: deliveries.length
  };
}

module.exports = { deliverPlainTextToGuildMembersViaUser };
