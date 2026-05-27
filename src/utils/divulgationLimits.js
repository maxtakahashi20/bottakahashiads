const { DIVULGATION } = require('../config/constants');

function clampDelayMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DIVULGATION.minIntervalMinutes;
  return Math.max(DIVULGATION.minIntervalMinutes, Math.floor(n));
}

function canSendToGuild(settings) {
  if (!settings?.nextSendAt) return true;
  return new Date(settings.nextSendAt).getTime() <= Date.now();
}

function nextSendDate(delayMinutes) {
  const min = clampDelayMinutes(delayMinutes);
  return new Date(Date.now() + min * 60_000);
}

module.exports = { clampDelayMinutes, canSendToGuild, nextSendDate };
