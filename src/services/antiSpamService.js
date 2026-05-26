const { z } = require('zod');
const { LIMITS, SECURITY } = require('../config/constants');
const { parseCategory, categoryHint } = require('../utils/categoryParser');

const urlRegex = /https?:\/\/[^\s]+/gi;

function zodMessagePt(issue) {
  const field = issue.path?.[0];
  const code = issue.code;

  if (field === 'title') {
    if (code === 'too_small') return 'Título muito curto (mínimo 3 caracteres).';
    if (code === 'too_big') return `Título muito longo (máximo ${LIMITS.titleMax} caracteres).`;
  }
  if (field === 'description') {
    if (code === 'too_small') return 'Descrição muito curta (mínimo 10 caracteres).';
    if (code === 'too_big') return `Descrição muito longa (máximo ${LIMITS.descriptionMax} caracteres).`;
  }
  if (field === 'inviteUrl') {
    return 'Link de convite inválido. Use um link começando com https://';
  }
  if (field === 'bannerUrl') {
    return 'URL do banner inválida. Deixe vazio ou use https://...';
  }

  return 'Verifique os campos do formulário e tente novamente.';
}

class AntiSpamService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  sanitizeText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  validateAndNormalizeAdInput(raw) {
    const category = parseCategory(raw.category);
    if (!category) {
      return {
        ok: false,
        error: `Categoria inválida. Digite apenas uma, por exemplo: **FIVEM**, **LOJA**, **ROLEPLAY**, **GAMING**.\nOpções: ${categoryHint()}`
      };
    }

    const bannerRaw = String(raw.bannerUrl || '').trim();

    const schema = z.object({
      title: z.string().min(3).max(LIMITS.titleMax),
      description: z.string().min(10).max(LIMITS.descriptionMax),
      inviteUrl: z.string().min(10).max(LIMITS.inviteUrlMax)
    });

    const parsed = schema.safeParse({
      title: raw.title,
      description: raw.description,
      inviteUrl: raw.inviteUrl
    });

    if (!parsed.success) {
      const msg = zodMessagePt(parsed.error.issues[0]);
      return { ok: false, error: msg };
    }

    const title = this.sanitizeText(parsed.data.title);
    const description = this.sanitizeText(parsed.data.description);
    let inviteUrl = this.sanitizeText(parsed.data.inviteUrl);

    if (!/^https?:\/\//i.test(inviteUrl)) {
      inviteUrl = `https://${inviteUrl}`;
    }

    try {
      // eslint-disable-next-line no-new
      new URL(inviteUrl);
    } catch {
      return { ok: false, error: 'Link de convite inválido. Ex: https://discord.gg/seuconvite' };
    }

    let bannerUrl = null;
    if (bannerRaw) {
      if (!/^https?:\/\//i.test(bannerRaw)) {
        return { ok: false, error: 'URL do banner inválida. Use https://... ou deixe em branco.' };
      }
      try {
        // eslint-disable-next-line no-new
        new URL(bannerRaw);
        bannerUrl = this.sanitizeText(bannerRaw);
      } catch {
        return { ok: false, error: 'URL do banner inválida.' };
      }
    }

    const joined = `${title}\n${description}\n${inviteUrl}\n${bannerUrl || ''}`.toLowerCase();

    for (const m of SECURITY.blockedMentions) {
      if (joined.includes(m)) {
        return { ok: false, error: `Menções ${m} não são permitidas.` };
      }
    }

    const urls = joined.match(urlRegex) || [];
    for (const u of urls) {
      for (const dom of SECURITY.blockedDomains) {
        if (u.includes(dom)) return { ok: false, error: 'Link suspeito detectado.' };
      }
    }

    return {
      ok: true,
      data: { title, description, bannerUrl, inviteUrl, category }
    };
  }

  async checkCooldown({ guildId, userId, userCooldownSec, guildCooldownSec }) {
    const now = Date.now();

    const ucKey = `user:${userId}`;
    const gcKey = `guild:${guildId}`;

    const uc = this.client.cooldownCache.get(ucKey);
    if (uc && uc > now) return { ok: false, scope: 'user', retryAfterMs: uc - now };

    const gc = this.client.cooldownCache.get(gcKey);
    if (gc && gc > now) return { ok: false, scope: 'guild', retryAfterMs: gc - now };

    const rows = await this.client.prisma.cooldown.findMany({
      where: {
        OR: [
          { scope: 'user', key: userId },
          { scope: 'guild', key: guildId }
        ]
      }
    });

    for (const r of rows) {
      const exp = r.expiresAt.getTime();
      this.client.cooldownCache.set(`${r.scope}:${r.key}`, exp);
      if (exp > now) {
        return { ok: false, scope: r.scope, retryAfterMs: exp - now };
      }
    }

    const userExp = new Date(now + userCooldownSec * 1000);
    const guildExp = new Date(now + guildCooldownSec * 1000);

    await this.client.prisma.cooldown.upsert({
      where: { scope_key: { scope: 'user', key: userId } },
      create: { scope: 'user', key: userId, expiresAt: userExp },
      update: { expiresAt: userExp }
    });
    await this.client.prisma.cooldown.upsert({
      where: { scope_key: { scope: 'guild', key: guildId } },
      create: { scope: 'guild', key: guildId, expiresAt: guildExp },
      update: { expiresAt: guildExp }
    });

    this.client.cooldownCache.set(ucKey, userExp.getTime());
    this.client.cooldownCache.set(gcKey, guildExp.getTime());

    return { ok: true };
  }
}

module.exports = { AntiSpamService };
