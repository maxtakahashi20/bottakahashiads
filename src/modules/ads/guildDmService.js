const { setTimeout: delay } = require('timers/promises');
const { fetchGuildMemberUserIds, sendDmAsUser } = require('../tokens/userTokenApi');
const { DM_BROADCAST } = require('../../config/constants');

function isDmClosedResult(result) {
  const code = result?.code;
  return code === 50007 || /cannot send messages|50007/i.test(result?.error || '');
}

function isRateLimitResult(result) {
  return result?.status === 429 || result?.retryAfterSec > 0;
}

/**
 * DM para membros do servidor usando token de usuário (sua conta precisa estar no servidor).
 */
async function deliverPlainTextToGuildMembersViaUser({
  userToken,
  guildId,
  accountUserId,
  content,
  delayMs,
  onProgress
}) {
  const membersRes = await fetchGuildMemberUserIds(guildId, userToken);
  if (!membersRes.ok) {
    return {
      ok: 0,
      fail: 0,
      dmClosed: 0,
      members: 0,
      deliveries: [],
      fatalError: membersRes.error,
      guildName: membersRes.guildName || null
    };
  }

  let memberIds = membersRes.memberIds;
  if (accountUserId) {
    memberIds = memberIds.filter((id) => id !== accountUserId);
  }

  let sent = 0;
  let fail = 0;
  let dmClosed = 0;
  const deliveries = [];
  const total = memberIds.length;

  for (let i = 0; i < memberIds.length; i += 1) {
    const userId = memberIds[i];
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

    if (i < memberIds.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await delay(delayMs);
    }
  }

  return {
    ok: sent,
    fail,
    dmClosed,
    members: total,
    deliveries,
    fatalError: null,
    guildName: membersRes.guildName || null
  };
}

module.exports = { deliverPlainTextToGuildMembersViaUser };
