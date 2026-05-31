/** Campanhas de DM ativas por administrador autorizado */
const active = new Map();

/**
 * @param {string} ownerId
 * @returns {{ abort: boolean, type: 'friends'|'guild', guildId?: string }}
 */
function startCampaign(ownerId, meta = {}) {
  const state = { abort: false, startedAt: Date.now(), ...meta };
  active.set(ownerId, state);
  return state;
}

/**
 * @param {string} ownerId
 */
function abortCampaign(ownerId) {
  const state = active.get(ownerId);
  if (state) state.abort = true;
  return Boolean(state);
}

/**
 * @param {string} ownerId
 */
function endCampaign(ownerId) {
  active.delete(ownerId);
}

/**
 * @param {string} ownerId
 */
function shouldAbortCampaign(ownerId) {
  return active.get(ownerId)?.abort === true;
}

/**
 * @param {string} ownerId
 */
function getActiveCampaign(ownerId) {
  return active.get(ownerId) || null;
}

module.exports = {
  startCampaign,
  abortCampaign,
  endCampaign,
  shouldAbortCampaign,
  getActiveCampaign
};
