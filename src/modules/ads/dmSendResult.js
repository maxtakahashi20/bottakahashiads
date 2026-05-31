function isDmClosedResult(result) {
  const code = result?.code;
  return code === 50007 || /cannot send messages|50007/i.test(result?.error || '');
}

function isRateLimitResult(result) {
  return result?.status === 429 || result?.retryAfterSec > 0;
}

/**
 * @param {object} result resposta de sendDmAsUser
 * @param {{ sent: number, fail: number, dmClosed: number, skipped: number }} stats
 */
function applyUserDmSendResult(result, stats) {
  if (result?.skipped) {
    stats.skipped += 1;
    return { status: 'skipped', error: result.reason || null };
  }
  if (!result?.ok) {
    if (isDmClosedResult(result)) {
      stats.dmClosed += 1;
      return { status: 'dm_closed', error: result.error || null };
    }
    stats.fail += 1;
    return { status: 'failed', error: result.error || null };
  }
  stats.sent += 1;
  return { status: 'sent', error: null };
}

module.exports = { isDmClosedResult, isRateLimitResult, applyUserDmSendResult };
