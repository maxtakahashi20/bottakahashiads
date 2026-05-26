const { AdCategory } = require('@prisma/client');

const VALID = Object.values(AdCategory);

/** Aceita FIVEM, FiveM, fivem, LOJA, RP, etc. */
const ALIASES = {
  fivem: AdCategory.FIVEM,
  fm: AdCategory.FIVEM,
  gta: AdCategory.FIVEM,
  gtarpp: AdCategory.FIVEM,
  roleplay: AdCategory.ROLEPLAY,
  rp: AdCategory.ROLEPLAY,
  role: AdCategory.ROLEPLAY,
  gaming: AdCategory.GAMING,
  game: AdCategory.GAMING,
  games: AdCategory.GAMING,
  jogo: AdCategory.GAMING,
  jogos: AdCategory.GAMING,
  store: AdCategory.STORE,
  loja: AdCategory.STORE,
  shop: AdCategory.STORE,
  lojas: AdCategory.STORE,
  community: AdCategory.COMMUNITY,
  comunidade: AdCategory.COMMUNITY,
  comm: AdCategory.COMMUNITY,
  other: AdCategory.OTHER,
  outros: AdCategory.OTHER,
  outro: AdCategory.OTHER,
  geral: AdCategory.OTHER
};

/**
 * @param {string} raw
 * @returns {string | null} AdCategory enum value
 */
function parseCategory(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  // Se colar "FIVEM, ROLEPLAY, ..." usa só o primeiro
  const first = text.split(/[,;|/]/)[0].trim();
  const normalized = first.toUpperCase().replace(/[\s-]+/g, '_');

  if (VALID.includes(normalized)) return normalized;

  const aliasKey = first
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (ALIASES[aliasKey]) return ALIASES[aliasKey];

  return null;
}

function categoryHint() {
  return VALID.join(', ');
}

module.exports = { parseCategory, categoryHint, VALID_CATEGORIES: VALID };
