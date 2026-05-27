const DISCORD_API = 'https://discord.com/api/v10';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * @param {string} userToken
 */
async function discordUserFetch(path, userToken, options = {}) {
  const token = userToken.trim().replace(/^Bot\s+/i, '');
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'User-Agent': USER_AGENT,
      ...options.headers
    }
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  const headerRetry = Number(res.headers.get('retry-after'));
  const bodyRetry = Number(data?.retry_after);
  const retryAfterSec =
    Number.isFinite(bodyRetry) && bodyRetry > 0
      ? bodyRetry
      : Number.isFinite(headerRetry) && headerRetry > 0
        ? headerRetry
        : null;

  return { ok: res.ok, status: res.status, data, retryAfterSec };
}

function formatApiError(status, data) {
  const msg = data?.message || `HTTP ${status}`;
  const code = data?.code ? ` (código ${data.code})` : '';
  if (status === 401) return `Token inválido ou expirado${code}. Gere um novo token.`;
  if (status === 403) return `Sem permissão no canal${code}: ${msg}`;
  if (status === 404) return 'Canal não encontrado — confira o ID';
  if (status === 429) return `Rate limit${code} — aguarde e tente de novo`;
  return `${msg}${code}`;
}

/**
 * Valida token de conta de usuário (não bot).
 */
async function validateUserToken(rawToken) {
  const { ok, status, data } = await discordUserFetch('/users/@me', rawToken);
  if (!ok) {
    throw new Error(formatApiError(status, data));
  }
  if (data.bot) {
    throw new Error('Este é um token de **bot**. Cole o token da sua **conta de usuário**.');
  }
  return {
    id: data.id,
    username: data.username,
    globalName: data.global_name || data.username,
    avatar: data.avatar
  };
}

function payloadToApiBody(payload) {
  const body = {};
  if (payload.content) body.content = String(payload.content).slice(0, 2000);
  if (payload.embeds?.length) {
    body.embeds = payload.embeds.map((e) => (typeof e.toJSON === 'function' ? e.toJSON() : e));
  }
  if (payload.components?.length) {
    body.components = payload.components.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
  }
  if (!body.content && !body.embeds?.length) {
    body.content = 'Divulgação — Takahashi Network';
  }
  return body;
}

/**
 * Envia mensagem em canal usando token de usuário.
 */
async function sendChannelMessageAsUser(channelId, userToken, payload) {
  const body = payloadToApiBody(payload);
  const { ok, status, data, retryAfterSec } = await discordUserFetch(`/channels/${channelId}/messages`, userToken, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (!ok) {
    return {
      ok: false,
      error: formatApiError(status, data),
      status,
      code: data?.code,
      raw: data,
      retryAfterSec
    };
  }
  return { ok: true, messageId: data.id };
}

async function getChannelAsUser(channelId, userToken) {
  return discordUserFetch(`/channels/${channelId}`, userToken);
}

async function getGuildAsUser(guildId, userToken) {
  return discordUserFetch(`/guilds/${guildId}`, userToken);
}

async function validateUserChannelAccess(channelId, guildId, userToken) {
  const ch = await getChannelAsUser(channelId, userToken);
  if (!ch.ok) {
    return {
      ok: false,
      error: formatApiError(ch.status, ch.data)
    };
  }
  const channelGuildId = ch.data?.guild_id;
  if (channelGuildId && guildId && channelGuildId !== guildId) {
    return { ok: false, error: 'Este canal não pertence ao servidor ID informado' };
  }
  let guildName = null;
  const gid = guildId || channelGuildId;
  if (gid) {
    const g = await getGuildAsUser(gid, userToken);
    if (g.ok) guildName = g.data?.name || null;
  }
  return { ok: true, guildName, channelName: ch.data?.name || null };
}

module.exports = {
  validateUserToken,
  sendChannelMessageAsUser,
  getChannelAsUser,
  getGuildAsUser,
  validateUserChannelAccess,
  formatApiError
};
