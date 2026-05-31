const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;

/** Quantas mensagens recentes verificar no canal/DM */
const HISTORY_LIMIT = 50;

function normalizeUrl(u) {
  return String(u || '')
    .toLowerCase()
    .trim()
    .replace(/[.,;!?]+$/g, '');
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractUrls(text) {
  const raw = String(text || '').match(urlRegex) || [];
  return [...new Set(raw.map(normalizeUrl).filter(Boolean))];
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Texto unificado de uma mensagem (API ou discord.js).
 * @param {object} msg
 */
function messageBodyText(msg) {
  const parts = [];
  if (msg.content) parts.push(msg.content);

  const embeds = msg.embeds || [];
  for (const e of embeds) {
    if (e.url) parts.push(e.url);
    if (e.description) parts.push(e.description);
    if (e.title) parts.push(e.title);
    if (e.data?.url) parts.push(e.data.url);
    if (e.data?.description) parts.push(e.data.description);
  }

  return parts.join('\n');
}

function messageAuthorId(msg) {
  return msg.author?.id || msg.author_id || msg.authorId || null;
}

/**
 * @param {string} outboundContent
 * @param {object} [payload] embed/components payload alternativo
 */
function buildOutboundFingerprint(outboundContent, payload = null) {
  const parts = [String(outboundContent || '')];
  if (payload?.content) parts.push(payload.content);
  if (payload?.embeds?.length) {
    for (const e of payload.embeds) {
      const data = typeof e.toJSON === 'function' ? e.toJSON() : e;
      if (data.url) parts.push(data.url);
      if (data.description) parts.push(data.description);
      if (data.title) parts.push(data.title);
      if (data.fields?.length) {
        for (const f of data.fields) {
          if (f.value) parts.push(f.value);
        }
      }
    }
  }
  return parts.join('\n');
}

/**
 * Verifica se já enviamos o mesmo link/conteúdo para este destino.
 * @param {object[]} messages histórico recente
 * @param {string} outboundText mensagem que seria enviada
 * @param {string} senderId ID da conta/bot que envia
 */
function isDuplicateDmContent(messages, outboundText, senderId) {
  if (!senderId || !Array.isArray(messages)) {
    return { duplicate: false };
  }

  const outText = buildOutboundFingerprint(outboundText);
  const outUrls = extractUrls(outText);
  const outNorm = normalizeText(outText);

  const ours = messages.filter((m) => String(messageAuthorId(m)) === String(senderId));

  for (const msg of ours) {
    const prevText = messageBodyText(msg);
    const prevUrls = extractUrls(prevText);
    const prevNorm = normalizeText(prevText);

    if (outUrls.length > 0) {
      for (const u of outUrls) {
        const hit = prevUrls.some(
          (pu) => pu === u || pu.includes(u) || u.includes(pu)
        );
        if (hit) {
          return { duplicate: true, reason: 'link_ja_enviado' };
        }
      }
    }

    if (outNorm.length >= 15 && prevNorm.length >= 15) {
      if (prevNorm === outNorm || prevNorm.includes(outNorm) || outNorm.includes(prevNorm)) {
        return { duplicate: true, reason: 'mensagem_ja_enviada' };
      }
    }
  }

  return { duplicate: false };
}

module.exports = {
  HISTORY_LIMIT,
  extractUrls,
  buildOutboundFingerprint,
  isDuplicateDmContent,
  messageBodyText
};
