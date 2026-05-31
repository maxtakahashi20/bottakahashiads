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

/** Divulgação por DM — /enviardm (amigos) e /enviardm-servidor */
const DM_BROADCAST = {
  messageMin: 1,
  messageMax: 4000,
  /** Mínimo absoluto entre cada DM (rate limit Discord) */
  delayMinSec: 2,
  /** Máximo configurável no modal */
  delayMaxSec: 120,
  /** Recomendado no placeholder — reduz risco de 429/ban */
  delayRecommendedSec: 3,
  /** Cooldown entre campanhas de DM no mesmo servidor */
  guildCooldownSec: 3600,
  progressUpdateEvery: 25
};

module.exports = { BRAND, LIMITS, SECURITY, DIVULGATION, DM_BROADCAST };

