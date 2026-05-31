const { setTimeout: delay } = require('timers/promises');
const { sendDmAsUser, sendFriendRequestThenMessage } = require('../tokens/userTokenApi');
const { isRateLimitResult } = require('./dmSendResult');

function shouldRetryWithFriendRequest(result) {
  if (!result || result.ok || result.skipped) return false;
  if (isRateLimitResult(result)) return false;
  return true;
}

/**
 * Mensagem direta; se falhar → pedido de amizade + mensagem (amigos e servidor).
 */
async function sendDmWithFriendRequestFallback({
  userId,
  userToken,
  content,
  accountUserId
}) {
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

module.exports = { sendDmWithFriendRequestFallback };
