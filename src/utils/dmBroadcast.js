const { DM_BROADCAST, SECURITY } = require('../config/constants');

const urlRegex = /https?:\/\/[^\s]+/gi;

function clampDelaySec(raw) {
  const n = Number(String(raw || '').trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const sec = Math.floor(n);
  if (sec < DM_BROADCAST.delayMinSec || sec > DM_BROADCAST.delayMaxSec) return null;
  return sec;
}

/**
 * @param {{ intervalo: string, mensagem: string, servidor_id?: string }} raw
 * @param {{ requireGuildId?: boolean }} [opts]
 */
function validateDmBroadcastInput(raw, opts = {}) {
  const delaySec = clampDelaySec(raw.intervalo);
  if (delaySec === null) {
    return {
      ok: false,
      error: `Intervalo inválido. Use entre **${DM_BROADCAST.delayMinSec}** e **${DM_BROADCAST.delayMaxSec}** segundos (recomendado **${DM_BROADCAST.delayRecommendedSec}s+**).`
    };
  }

  let guildId = null;
  if (opts.requireGuildId) {
    guildId = String(raw.servidor_id || '').trim();
    if (!isSnowflake(guildId)) {
      return {
        ok: false,
        error: '**ID do servidor** inválido. Copie o ID do Discord (17–20 dígitos).'
      };
    }
  }

  const mensagem = String(raw.mensagem || '').trim();
  if (mensagem.length < DM_BROADCAST.messageMin) {
    return { ok: false, error: 'A mensagem não pode estar vazia.' };
  }
  if (mensagem.length > DM_BROADCAST.messageMax) {
    return {
      ok: false,
      error: `Mensagem muito longa (máximo ${DM_BROADCAST.messageMax} caracteres).`
    };
  }

  const lower = mensagem.toLowerCase();
  for (const m of SECURITY.blockedMentions) {
    if (lower.includes(m)) {
      return { ok: false, error: `Menções ${m} não são permitidas.` };
    }
  }

  const urls = lower.match(urlRegex) || [];
  for (const u of urls) {
    for (const dom of SECURITY.blockedDomains) {
      if (u.includes(dom)) return { ok: false, error: 'Link suspeito detectado na mensagem.' };
    }
  }

  return { ok: true, data: { delaySec, mensagem, guildId } };
}

function dmBroadcastGuildCooldownKey(guildId) {
  return `dm_broadcast:guild:${guildId}`;
}

function dmBroadcastFriendsCooldownKey(ownerUserId) {
  return `dm_broadcast:friends:${ownerUserId}`;
}

function isSnowflake(id) {
  return /^\d{17,20}$/.test(String(id || ''));
}

/**
 * @param {import('../structures/ExtendedClient').ExtendedClient} client
 * @param {string} guildId
 */
function checkDmBroadcastCooldown(client, key) {
  const exp = client.cooldownCache.get(key);
  const now = Date.now();
  if (exp && exp > now) {
    return { ok: false, retryAfterMs: exp - now };
  }
  return { ok: true };
}

/**
 * @param {import('../structures/ExtendedClient').ExtendedClient} client
 * @param {string} guildId
 */
function setDmBroadcastCooldown(client, key) {
  const exp = Date.now() + DM_BROADCAST.guildCooldownSec * 1000;
  client.cooldownCache.set(key, exp);
}

module.exports = {
  clampDelaySec,
  validateDmBroadcastInput,
  checkDmBroadcastCooldown,
  setDmBroadcastCooldown,
  dmBroadcastGuildCooldownKey,
  dmBroadcastFriendsCooldownKey,
  isSnowflake
};
