const BRAND = {
  name: 'Takahashi Network',
  storeName: 'Takahashi Store',
  footer: 'Powered by Takahashi Network',
  color: 0x7c3aed,
  accent: 0x22c55e,
  /** Slug padrão do link de parceria (/invite) */
  defaultInviteSlug: 'takahashi-store'
};

const LIMITS = {
  titleMax: 80,
  descriptionMax: 900,
  bannerUrlMax: 400,
  inviteUrlMax: 200
};

/** Intervalo mínimo entre divulgações no mesmo servidor / ciclo global */
const DIVULGATION = {
  minIntervalMinutes: 50
};

const SECURITY = {
  blockedMentions: ['@everyone', '@here'],
  // links tipicamente usados em scam; mantém conservador (false positives são caros).
  blockedDomains: [
    'bit.ly',
    'grabify',
    'iplogger',
    'discordgift',
    'steamcommunity.ru'
  ]
};

module.exports = { BRAND, LIMITS, SECURITY, DIVULGATION };

