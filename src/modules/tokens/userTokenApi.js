const DISCORD_API = 'https://discord.com/api/v10';
const { splitDiscordContent } = require('../../utils/discordMessage');
const {
  HISTORY_LIMIT,
  isDuplicateDmContent,
  buildOutboundFingerprint
} = require('../../utils/dmAntiflood');
const { DM_BROADCAST } = require('../../config/constants');

/** Discord às vezes devolve retry-after absurdo (horas) — limitamos para não travar o bot. */
const MAX_RETRY_AFTER_SEC = 600;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SUPER_PROPERTIES = Buffer.from(
  JSON.stringify({
    os: 'Windows',
    browser: 'Discord Client',
    release_channel: 'stable',
    client_version: '1.0.9159',
    os_version: '10.0.26200',
    os_arch: 'x64',
    system_locale: 'pt-BR',
    browser_user_agent: USER_AGENT,
    browser_version: '120.0.0.0',
    client_build_number: 300000,
    native_build_number: 44431,
    client_event_source: null
  })
).toString('base64');

/** Remove espaços/quebras do modal e prefixos comuns */
function normalizeUserToken(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^["'`]+|["'`]+$/g, '');
  t = t.replace(/^Bearer\s+/i, '').replace(/^Bot\s+/i, '');
  t = t.replace(/\s+/g, '');
  return t;
}

/**
 * @param {string} userToken
 */
async function discordUserFetch(path, userToken, options = {}) {
  const token = normalizeUserToken(userToken);
  const method = (options.method || 'GET').toUpperCase();
  const hasBody = options.body != null && String(options.body).length > 0;

  const headers = {
    Authorization: token,
    'User-Agent': USER_AGENT,
    'X-Super-Properties': SUPER_PROPERTIES,
    'X-Discord-Locale': 'pt-BR',
    ...options.headers
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOpts = {
    method,
    headers
  };
  if (hasBody) fetchOpts.body = options.body;

  const res = await fetch(`${DISCORD_API}${path}`, fetchOpts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  const headerRetry = Number(res.headers.get('retry-after'));
  const bodyRetry = Number(data?.retry_after);
  let retryAfterSec =
    Number.isFinite(bodyRetry) && bodyRetry > 0
      ? bodyRetry
      : Number.isFinite(headerRetry) && headerRetry > 0
        ? headerRetry
        : null;
  if (retryAfterSec != null) {
    retryAfterSec = Math.min(MAX_RETRY_AFTER_SEC, Math.max(1, Math.ceil(retryAfterSec)));
  }

  return { ok: res.ok, status: res.status, data, retryAfterSec };
}

function formatApiError(status, data) {
  const msg = data?.message || `HTTP ${status}`;
  const code = data?.code ? ` (código ${data.code})` : '';
  if (data?.code === 50109) {
    return `Requisição inválida à API do Discord${code}. Cole o TOKEN em **uma linha**, sem aspas nem espaços no meio.`;
  }
  if (status === 401) return `Token inválido ou expirado${code}. Gere um novo token.`;
  if (status === 403) return `Sem permissão no canal${code}: ${msg}`;
  if (status === 404) return 'Canal não encontrado — confira o ID';
  if (status === 429) return `Rate limit${code} — aguarde e tente de novo`;
  if (data?.code === 200000 || /automod/i.test(msg)) {
    return `Mensagem bloqueada pelo **AutoMod** do servidor${code}. Ajuste o texto ou peça ao admin para liberar.`;
  }
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

function sanitizeMessageContent(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function payloadToApiBody(payload) {
  const body = {};
  if (payload.content) body.content = sanitizeMessageContent(payload.content).slice(0, 2000);
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

const GUILD_MEMBERS_PAGE = 1000;
const GUILD_MEMBERS_PAGE_DELAY_MS = 600;

/**
 * Lista IDs de membros humanos do servidor (conta do token precisa estar no servidor).
 */
async function fetchGuildMemberUserIds(guildId, userToken) {
  const g = await getGuildAsUser(guildId, userToken);
  let guildName = null;
  if (g.ok) guildName = g.data?.name || null;
  else if (g.status === 403 || g.status === 404) {
    return {
      ok: false,
      error:
        g.status === 404
          ? 'Servidor não encontrado. Confira o ID.'
          : 'Sua conta **não está** neste servidor (ou sem acesso). Entre no Discord e tente de novo.',
      guildName: null
    };
  }

  const ids = [];
  let after = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let path = `/guilds/${guildId}/members?limit=${GUILD_MEMBERS_PAGE}`;
    if (after) path += `&after=${after}`;

    // eslint-disable-next-line no-await-in-loop
    const { ok, status, data, retryAfterSec } = await discordUserFetch(path, userToken);
    if (!ok) {
      if (status === 429 && retryAfterSec) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
        continue;
      }
      return {
        ok: false,
        error:
          status === 403
            ? 'Sem permissão para listar membros. Sua conta precisa estar no servidor.'
            : formatApiError(status, data),
        guildName
      };
    }

    const chunk = Array.isArray(data) ? data : [];
    for (const m of chunk) {
      if (m?.user?.bot) continue;
      if (m?.user?.id) ids.push(String(m.user.id));
    }

    if (chunk.length < GUILD_MEMBERS_PAGE) break;
    after = chunk[chunk.length - 1]?.user?.id;
    if (!after) break;

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, GUILD_MEMBERS_PAGE_DELAY_MS));
  }

  return { ok: true, memberIds: [...new Set(ids)], guildName };
}

/**
 * Lista IDs de amigos (relationship type 1) da conta do token.
 * @returns {Promise<string[]>}
 */
/**
 * Fallback: usuários com DM aberta (quando /relationships bloqueia).
 */
async function fetchDmRecipientIds(userToken) {
  const { ok, status, data, retryAfterSec } = await discordUserFetch('/users/@me/channels', userToken);
  if (!ok) {
    return {
      ok: false,
      error: formatApiError(status, data),
      status,
      code: data?.code,
      retryAfterSec
    };
  }
  const channels = Array.isArray(data) ? data : [];
  const ids = [];
  for (const ch of channels) {
    if (ch?.type !== 1) continue;
    for (const u of ch.recipients || []) {
      if (u?.id && !u?.bot) ids.push(String(u.id));
    }
  }
  return { ok: true, friendIds: [...new Set(ids)], source: 'dm_channels' };
}

async function fetchFriendUserIds(userToken) {
  const { ok, status, data, retryAfterSec } = await discordUserFetch(
    '/users/@me/relationships',
    userToken
  );

  if (ok) {
    const list = Array.isArray(data) ? data : [];
    const ids = list
      .filter((r) => r?.type === 1 && r?.id)
      .map((r) => String(r.id));
    return { ok: true, friendIds: [...new Set(ids)], source: 'relationships' };
  }

  if (status === 50109 || status === 403 || status === 400) {
    const fallback = await fetchDmRecipientIds(userToken);
    if (fallback.ok && fallback.friendIds.length > 0) {
      return {
        ok: true,
        friendIds: fallback.friendIds,
        source: 'dm_channels',
        notice:
          'Lista de amigos indisponível na API; usei contatos com **DM aberta** na sua conta.'
      };
    }
    if (!fallback.ok && fallback.error) {
      return {
        ok: false,
        error: `${formatApiError(status, data)} Alternativa (DMs): ${fallback.error}`,
        status,
        code: data?.code,
        retryAfterSec
      };
    }
  }

  return {
    ok: false,
    error: formatApiError(status, data),
    status,
    code: data?.code,
    retryAfterSec
  };
}

async function openDmChannelAsUser(recipientId, userToken) {
  const recipient = String(recipientId || '').trim();
  const body = JSON.stringify({ recipient_id: recipient });
  const { ok, status, data, retryAfterSec } = await discordUserFetch('/users/@me/channels', userToken, {
    method: 'POST',
    body
  });
  if (!ok) {
    return {
      ok: false,
      error: formatApiError(status, data),
      status,
      code: data?.code,
      retryAfterSec
    };
  }
  return { ok: true, channelId: data.id };
}

async function sendChannelMessageChunks(channelId, userToken, contentParts) {
  let lastMessageId = null;
  for (const part of contentParts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await sendChannelMessageAsUser(channelId, userToken, { content: part });
    if (!result.ok) return result;
    lastMessageId = result.messageId;
  }
  return { ok: true, messageId: lastMessageId };
}

async function fetchChannelMessagesAsUser(channelId, userToken, limit = HISTORY_LIMIT) {
  return discordUserFetch(`/channels/${channelId}/messages?limit=${limit}`, userToken);
}

/**
 * Envia DM usando token de usuário (conta pessoal) com antflood.
 * @param {string} [accountUserId] — ID da conta do token (para não repetir link/mensagem)
 */
async function sendDmAsUser(recipientId, userToken, content, accountUserId = null) {
  const open = await openDmChannelAsUser(recipientId, userToken);
  if (!open.ok) return { ...open, skipped: false };

  if (accountUserId) {
    const hist = await fetchChannelMessagesAsUser(open.channelId, userToken);
    if (hist.ok && Array.isArray(hist.data)) {
      const dup = isDuplicateDmContent(hist.data, content, accountUserId);
      if (dup.duplicate) {
        return { ok: true, skipped: true, reason: dup.reason, channelId: open.channelId };
      }
    }
    await new Promise((r) => setTimeout(r, DM_BROADCAST.antifloodCheckDelayMs));
  }

  const parts = splitDiscordContent(content);
  const sent = await sendChannelMessageChunks(open.channelId, userToken, parts);
  return { ...sent, skipped: false };
}

/**
 * Antflood para envio em canal (divulgação com token de usuário).
 */
async function shouldSkipChannelDuplicate(channelId, userToken, senderId, payload) {
  if (!senderId) return { skip: false };
  const hist = await fetchChannelMessagesAsUser(channelId, userToken, HISTORY_LIMIT);
  if (!hist.ok || !Array.isArray(hist.data)) return { skip: false };
  const text = buildOutboundFingerprint('', payload);
  const dup = isDuplicateDmContent(hist.data, text, senderId);
  return { skip: dup.duplicate, reason: dup.reason };
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
  normalizeUserToken,
  validateUserToken,
  sendChannelMessageAsUser,
  fetchFriendUserIds,
  fetchGuildMemberUserIds,
  openDmChannelAsUser,
  fetchChannelMessagesAsUser,
  sendDmAsUser,
  shouldSkipChannelDuplicate,
  getChannelAsUser,
  getGuildAsUser,
  validateUserChannelAccess,
  formatApiError
};
