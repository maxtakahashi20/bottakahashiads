const { setTimeout: delay } = require('timers/promises');
const { fetchFriendUserIds, sendDmAsUser } = require('../tokens/userTokenApi');
const { DM_BROADCAST } = require('../../config/constants');

function isDmClosedResult(result) {
  const code = result?.code;
  return code === 50007 || /cannot send messages|50007/i.test(result?.error || '');
}

function isRateLimitResult(result) {
  return result?.status === 429 || result?.retryAfterSec > 0;
}

/**
 * Envia mensagem por DM para cada amigo da conta (token de usuário).
 * @param {object} opts
 * @param {string} opts.userToken
 * @param {string} [opts.accountUserId] — não envia para si mesmo
 * @param {string} opts.content
 * @param {number} opts.delayMs
 * @param {(stats: object) => Promise<void>} [opts.onProgress]
 */
async function deliverPlainTextToFriends({
  userToken,
  accountUserId,
  content,
  delayMs,
  onProgress
}) {
  const friendsRes = await fetchFriendUserIds(userToken);
  if (!friendsRes.ok) {
    return {
      ok: 0,
      fail: 0,
      dmClosed: 0,
      members: 0,
      deliveries: [],
      fatalError: friendsRes.error
    };
  }

  let friendIds = friendsRes.friendIds;
  if (accountUserId) {
    friendIds = friendIds.filter((id) => id !== accountUserId);
  }

  let sent = 0;
  let fail = 0;
  let dmClosed = 0;
  const deliveries = [];
  const total = friendIds.length;

  for (let i = 0; i < friendIds.length; i += 1) {
    const userId = friendIds[i];
    // eslint-disable-next-line no-await-in-loop
    let result = await sendDmAsUser(userId, userToken, content);

    if (isRateLimitResult(result)) {
      const waitMs = (result.retryAfterSec ?? 5) * 1000;
      // eslint-disable-next-line no-await-in-loop
      await delay(waitMs);
      // eslint-disable-next-line no-await-in-loop
      result = await sendDmAsUser(userId, userToken, content);
    }

    let status = 'sent';
    if (!result.ok) {
      if (isDmClosedResult(result)) {
        status = 'dm_closed';
        dmClosed += 1;
      } else {
        status = 'failed';
        fail += 1;
      }
    } else {
      sent += 1;
    }

    deliveries.push({ userId, status, error: result.error || null });

    const processed = i + 1;
    if (
      onProgress &&
      (processed % DM_BROADCAST.progressUpdateEvery === 0 || processed === total)
    ) {
      // eslint-disable-next-line no-await-in-loop
      await onProgress({ sent, failed: fail, dmClosed, total, processed });
    }

    if (i < friendIds.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await delay(delayMs);
    }
  }

  return { ok: sent, fail, dmClosed, members: total, deliveries, fatalError: null };
}

module.exports = { deliverPlainTextToFriends };
