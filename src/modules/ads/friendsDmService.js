const { setTimeout: delay } = require('timers/promises');
const { fetchFriendUserIds } = require('../tokens/userTokenApi');
const { sendDmWithFriendRequestFallback } = require('./userDmDelivery');
const { DM_BROADCAST } = require('../../config/constants');
const { applyUserDmSendResult } = require('./dmSendResult');

/**
 * Envia mensagem por DM para cada amigo da conta (token de usuário).
 */
async function deliverPlainTextToFriends({
  userToken,
  accountUserId,
  content,
  delayMs,
  onProgress,
  shouldAbort
}) {
  const friendsRes = await fetchFriendUserIds(userToken);
  if (!friendsRes.ok) {
    return {
      ok: 0,
      fail: 0,
      dmClosed: 0,
      skipped: 0,
      friendRequestsSent: 0,
      friendRequestRetries: 0,
      members: 0,
      deliveries: [],
      fatalError: friendsRes.error,
      notice: null
    };
  }

  const notices = [];
  if (friendsRes.notice) notices.push(friendsRes.notice);
  notices.push(
    'Fluxo: **mensagem no privado**. Se o Discord recusar → **pedido de amizade** e mensagem de novo.'
  );
  if (friendsRes.source === 'dm_channels') {
    notices.push(
      'Parte da lista veio de **DMs antigas** (não só amigos). Quem não for amigo pode falhar até aceitar o pedido de amizade.'
    );
  }

  let friendIds = friendsRes.friendIds;
  if (accountUserId) {
    friendIds = friendIds.filter((id) => id !== accountUserId);
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
  const total = friendIds.length;
  let aborted = false;

  for (let i = 0; i < friendIds.length; i += 1) {
    if (shouldAbort?.()) {
      aborted = true;
      break;
    }

    const userId = friendIds[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await sendDmWithFriendRequestFallback({
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
        detailError = 'Primeira tentativa falhou; entregue após pedido de amizade + mensagem.';
      } else if (detailError) {
        detailError = `Primeira tentativa: ${result.firstAttemptError || 'erro'}. Depois (amizade + msg): ${detailError}`;
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

    if (i < friendIds.length - 1) {
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
    notice: notices.join('\n'),
    aborted,
    processed: deliveries.length
  };
}

module.exports = { deliverPlainTextToFriends };
