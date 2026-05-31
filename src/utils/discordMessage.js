/** Limite de caracteres por mensagem no Discord */
const DISCORD_MESSAGE_MAX = 2000;

/**
 * Divide texto longo em partes enviáveis (DM/canal).
 * @param {string} text
 * @param {number} [maxLen]
 */
function splitDiscordContent(text, maxLen = DISCORD_MESSAGE_MAX) {
  const s = String(text || '');
  if (s.length <= maxLen) return [s];
  const parts = [];
  let rest = s;
  while (rest.length > 0) {
    parts.push(rest.slice(0, maxLen));
    rest = rest.slice(maxLen);
  }
  return parts;
}

module.exports = { DISCORD_MESSAGE_MAX, splitDiscordContent };
