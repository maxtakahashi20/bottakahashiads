const { z } = require('zod');
const { AdCategory } = require('@prisma/client');
const { LIMITS, SECURITY } = require('../config/constants');

const VALID_CATEGORIES = Object.values(AdCategory);

const urlRegex = /https?:\/\/[^\s]+/gi;

class AntiSpamService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  sanitizeText(s) {
    const str = String(s || '').replace(/\s+/g, ' ').trim();
    return str;
  }

  validateAndNormalizeAdInput(raw) {
    const schema = z.object({
      title: z.string().min(3).max(LIMITS.titleMax),
      description: z.string().min(10).max(LIMITS.descriptionMax),
      bannerUrl: z.string().url().max(LIMITS.bannerUrlMax).optional().or(z.literal('')),
      inviteUrl: z.string().url().max(LIMITS.inviteUrlMax),
      category: z.string().min(2).max(30)
    });

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Entrada inválida.';
      return { ok: false, error: msg };
    }

    const data = parsed.data;
    const title = this.sanitizeText(data.title);
    const description = this.sanitizeText(data.description);
    const inviteUrl = this.sanitizeText(data.inviteUrl);
    const bannerUrl = data.bannerUrl ? this.sanitizeText(data.bannerUrl) : null;
    const category = this.sanitizeText(data.category).toUpperCase().replace(/\s+/g, '_');

    if (!VALID_CATEGORIES.includes(category)) {
      return {
        ok: false,
        error: `Categoria inválida. Use: ${VALID_CATEGORIES.join(', ')}`
      };
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

    // cache rápido antes de ir ao banco
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

    // set novos cooldowns
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

