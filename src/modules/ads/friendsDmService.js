const { setTimeout: delay } = require('timers/promises');
const { fetchFriendUserIds, sendDmAsUser } = require('../tokens/userTokenApi');
const { DM_BROADCAST } = require('../../config/constants');
const { isRateLimitResult, applyUserDmSendResult } = require('./dmSendResult');

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
      members: 0,
      deliveries: [],
      fatalError: friendsRes.error,
      notice: null
    };
  }

  const listNotice = friendsRes.notice || null;

  let friendIds = friendsRes.friendIds;
  if (accountUserId) {
    friendIds = friendIds.filter((id) => id !== accountUserId);
  }

  const stats = { sent: 0, fail: 0, dmClosed: 0, skipped: 0 };
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
    let result = await sendDmAsUser(userId, userToken, content, accountUserId);

    if (isRateLimitResult(result) && !result.skipped) {
      const waitMs = (result.retryAfterSec ?? 60) * 1000;
      // eslint-disable-next-line no-await-in-loop
      await delay(waitMs);
      // eslint-disable-next-line no-await-in-loop
      result = await sendDmAsUser(userId, userToken, content, accountUserId);
    }

    const { status, error } = applyUserDmSendResult(result, stats);
    deliveries.push({ userId, status, error });

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
    members: total,
    deliveries,
    fatalError: null,
    notice: listNotice,
    aborted,
    processed: deliveries.length
  };
}

module.exports = { deliverPlainTextToFriends };
