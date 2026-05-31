const { setTimeout: delay } = require('timers/promises');
const { fetchGuildMemberUserIds, sendDmAsUser } = require('../tokens/userTokenApi');
const { DM_BROADCAST } = require('../../config/constants');
const { isRateLimitResult, applyUserDmSendResult } = require('./dmSendResult');

/**
 * DM para membros do servidor usando token de usuário.
 */
async function deliverPlainTextToGuildMembersViaUser({
  userToken,
  guildId,
  accountUserId,
  content,
  delayMs,
  onProgress,
  shouldAbort
}) {
  const membersRes = await fetchGuildMemberUserIds(guildId, userToken);
  if (!membersRes.ok) {
    return {
      ok: 0,
      fail: 0,
      dmClosed: 0,
      skipped: 0,
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

  const stats = { sent: 0, fail: 0, dmClosed: 0, skipped: 0 };
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
    members: total,
    deliveries,
    fatalError: null,
    guildName: membersRes.guildName || null,
    aborted,
    processed: deliveries.length
  };
}

module.exports = { deliverPlainTextToGuildMembersViaUser };
