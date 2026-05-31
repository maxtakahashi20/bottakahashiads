const { DM_BROADCAST, SECURITY } = require('../config/constants');
const { normalizeUserToken } = require('../modules/tokens/userTokenApi');

const urlRegex = /https?:\/\/[^\s]+/gi;

function clampDelaySec(raw) {
  const n = Number(String(raw || '').trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const sec = Math.floor(n);
  if (sec < DM_BROADCAST.delayMinSec || sec > DM_BROADCAST.delayMaxSec) return null;
  return sec;
}

/**
 * @param {{ token?: string, intervalo: string, mensagem: string, servidor_id?: string }} raw
 * @param {{ requireGuildId?: boolean, requireToken?: boolean }} [opts]
 */
function validateDmBroadcastInput(raw, opts = {}) {
  if (opts.requireToken) {
    const token = normalizeUserToken(raw.token);
    if (token.length < 20) {
      return {
        ok: false,
        error: 'Campo TOKEN obrigatório. Informe o token da conta de usuário (não use token de bot).'
      };
    }
    raw._token = token;
  }

  const delaySec = clampDelaySec(raw.intervalo);
  if (delaySec === null) {
    return {
      ok: false,
      error: `Intervalo inválido. Informe entre ${DM_BROADCAST.delayMinSec} e ${DM_BROADCAST.delayMaxSec} segundos (recomendado: ${DM_BROADCAST.delayRecommendedSec}s).`
    };
  }

  let guildId = null;
  if (opts.requireGuildId) {
    guildId = String(raw.servidor_id || '').trim();
    if (!isSnowflake(guildId)) {
      return {
        ok: false,
        error: 'ID DISCORD inválido. O identificador do servidor deve ter entre 17 e 20 dígitos numéricos.'
      };
    }
  }

  const mensagem = String(raw.mensagem || '').trim();
  if (mensagem.length < DM_BROADCAST.messageMin) {
    return { ok: false, error: 'Campo Mensagem obrigatório.' };
  }
  if (mensagem.length > DM_BROADCAST.messageMax) {
    return {
      ok: false,
      error: `Mensagem excede o limite de ${DM_BROADCAST.messageMax} caracteres.`
    };
  }

  const lower = mensagem.toLowerCase();
  for (const m of SECURITY.blockedMentions) {
    if (lower.includes(m)) {
      return { ok: false, error: `Conteúdo não permitido: menção ${m}.` };
    }
  }

  const urls = lower.match(urlRegex) || [];
  for (const u of urls) {
    for (const dom of SECURITY.blockedDomains) {
      if (u.includes(dom)) {
        return { ok: false, error: `Link não permitido na mensagem (domínio: ${dom}).` };
      }
    }
  }

  return {
    ok: true,
    data: {
      delaySec,
      mensagem,
      guildId,
      token: raw._token || normalizeUserToken(raw.token)
    }
  };
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

function clearDmBroadcastCooldown(client, key) {
  client.cooldownCache.delete(key);
}

/**
 * Remove cooldowns de DM (amigos do dono + todos os servidores em cache).
 * @param {import('../structures/ExtendedClient').ExtendedClient} client
 * @param {string} ownerId
 * @param {{ guildId?: string }} [opts]
 * @returns {{ cleared: string[] }}
 */
function clearDmBroadcastCooldowns(client, ownerId, opts = {}) {
  const cleared = [];
  const friendsKey = dmBroadcastFriendsCooldownKey(ownerId);
  if (client.cooldownCache.has(friendsKey)) {
    client.cooldownCache.delete(friendsKey);
    cleared.push('amigos');
  }
  if (opts.guildId) {
    const gKey = dmBroadcastGuildCooldownKey(opts.guildId);
    if (client.cooldownCache.has(gKey)) {
      client.cooldownCache.delete(gKey);
      cleared.push(`servidor:${opts.guildId}`);
    }
  } else {
    for (const key of [...client.cooldownCache.keys()]) {
      if (key.startsWith('dm_broadcast:guild:')) {
        client.cooldownCache.delete(key);
        if (!cleared.includes('servidores')) cleared.push('servidores');
      }
    }
  }
  return { cleared };
}

module.exports = {
  clampDelaySec,
  validateDmBroadcastInput,
  checkDmBroadcastCooldown,
  setDmBroadcastCooldown,
  clearDmBroadcastCooldown,
  clearDmBroadcastCooldowns,
  dmBroadcastGuildCooldownKey,
  dmBroadcastFriendsCooldownKey,
  isSnowflake
};
