const { prisma } = require('../database/prisma');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const {
  validateUserToken,
  sendChannelMessageAsUser,
  validateUserChannelAccess
} = require('../modules/tokens/userTokenApi');
const { maskSecret } = require('../modules/panel/panelFormat');
const { isMissingTableError } = require('../utils/prismaSafe');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPermissionError(result) {
  return result.status === 403 || result.code === 50001 || /sem permissão|50001|falta acesso/i.test(result.error || '');
}

class UserTokenService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this._rr = 0;
    this._cache = { list: null, at: 0 };
    this._cacheMs = 4000;
    this._lastSendError = null;
    /** @type {Map<string, number>} tokenId -> timestamp ms até poder usar de novo */
    this._rateLimitedUntil = new Map();
    /** @type {Map<string, { reason: string, until: number }>} channelId -> bloqueio temporário */
    this._blockedChannels = new Map();
  }

  getLastError() {
    return this._lastSendError;
  }

  _invalidate() {
    this._cache = { list: null, at: 0, tenantId: null };
  }

  async _safe(op, fallback) {
    try {
      return await op();
    } catch (err) {
      if (isMissingTableError(err)) {
        this.client.logger?.warn('Tabela UserToken ausente — rode prisma/migrations/user_tokens.sql');
        return fallback;
      }
      throw err;
    }
  }

  async listActive(tenantId = PLATFORM_TENANT_ID) {
    const cacheKey = tenantId;
    const now = Date.now();
    if (this._cache.tenantId === cacheKey && this._cache.list && now - this._cache.at < this._cacheMs) {
      return this._cache.list;
    }
    const list = await this._safe(
      () =>
        prisma.userToken.findMany({
          where: { active: true, tenantId },
          orderBy: { slot: 'asc' }
        }),
      []
    );
    this._cache = { list, at: now, tenantId: cacheKey };
    return list;
  }

  async listAll() {
    return this._safe(() => prisma.userToken.findMany({ orderBy: { slot: 'asc' } }), []);
  }

  async countActive() {
    return this._safe(() => prisma.userToken.count({ where: { active: true } }), 0);
  }

  async getDecrypted(row) {
    return decrypt(row.tokenEnc);
  }

  async pick() {
    const list = await this.listActive();
    if (!list.length) return null;
    const row = list[this._rr % list.length];
    this._rr = (this._rr + 1) % list.length;
    return row;
  }

  async addToken({ rawToken, ownerId, tenantId = PLATFORM_TENANT_ID }) {
    const profile = await validateUserToken(rawToken);
    try {
      return await this._addTokenDb({ rawToken, ownerId, profile, tenantId });
    } catch (err) {
      if (isMissingTableError(err)) {
        throw new Error(
          'Tabela de tokens não existe no banco. Rode: `npx prisma db execute --file prisma/migrations/user_tokens.sql`'
        );
      }
      throw err;
    }
  }

  async _addTokenDb({ rawToken, ownerId, profile, tenantId = PLATFORM_TENANT_ID }) {
    const existing = await prisma.userToken.findFirst({
      where: { tenantId, discordUserId: profile.id }
    });
    if (existing) {
      await prisma.userToken.update({
        where: { id: existing.id },
        data: {
          tokenEnc: encrypt(rawToken.trim()),
          username: profile.globalName || profile.username,
          active: true,
          lastError: null,
          ownerId
        }
      });
      this._invalidate();
      return { updated: true, slot: existing.slot, profile };
    }

    const maxSlot = await prisma.userToken.aggregate({
      where: { tenantId },
      _max: { slot: true }
    });
    const slot = (maxSlot._max.slot || 0) + 1;

    await prisma.userToken.create({
      data: {
        tenantId,
        slot,
        ownerId,
        discordUserId: profile.id,
        username: profile.globalName || profile.username,
        tokenEnc: encrypt(rawToken.trim()),
        active: true
      }
    });
    this._invalidate();
    return { updated: false, slot, profile };
  }

  async removeBySlot(slot, tenantId = PLATFORM_TENANT_ID) {
    const n = Number(slot);
    const row = await prisma.userToken.findFirst({ where: { tenantId, slot: n } });
    if (!row) return false;
    await prisma.userToken.delete({ where: { id: row.id } });
    this._invalidate();
    return true;
  }

  async markUsed(id, error = null) {
    const deactivate = error && /token inválido|expirado|401/i.test(String(error));
    await prisma.userToken.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        lastError: error ? String(error).slice(0, 200) : null,
        ...(deactivate ? { active: false } : {})
      }
    });
    this._invalidate();
  }

  _isTokenRateLimited(tokenId) {
    const until = this._rateLimitedUntil.get(tokenId);
    if (!until) return false;
    if (Date.now() >= until) {
      this._rateLimitedUntil.delete(tokenId);
      return false;
    }
    return true;
  }

  _markTokenRateLimited(tokenId, retryAfterSec) {
    const waitSec = Math.max(1, Math.ceil(retryAfterSec || 5));
    this._rateLimitedUntil.set(tokenId, Date.now() + waitSec * 1000);
    return waitSec;
  }

  isChannelBlocked(channelId) {
    const block = this._blockedChannels.get(channelId);
    if (!block) return null;
    if (Date.now() >= block.until) {
      this._blockedChannels.delete(channelId);
      return null;
    }
    return block.reason;
  }

  _blockChannel(channelId, reason, hours = 6) {
    this._blockedChannels.set(channelId, {
      reason,
      until: Date.now() + hours * 60 * 60 * 1000
    });
  }

  async auditActiveTokens() {
    const list = await this.listActive();
    if (!list.length) {
      this.client.logger.warn('Nenhum token de usuário ativo — cadastre em /painel → Tokens');
      return { valid: 0, invalid: 0 };
    }

    let valid = 0;
    let invalid = 0;
    for (const row of list) {
      try {
        const token = await this.getDecrypted(row);
        // eslint-disable-next-line no-await-in-loop
        await validateUserToken(token);
        valid += 1;
      } catch (err) {
        invalid += 1;
        this.client.logger.warn(
          { slot: row.slot, error: err.message },
          'Token de usuário inválido — desativado'
        );
        // eslint-disable-next-line no-await-in-loop
        await this.markUsed(row.id, err.message);
      }
    }
    if (invalid > 0) {
      this.client.logger.warn(
        { valid, invalid },
        'Tokens expirados desativados — gere novos em /painel → Tokens'
      );
    }
    return { valid, invalid };
  }

  async _sendWithToken(channelId, token, payload, row) {
    let result = await sendChannelMessageAsUser(channelId, token, payload);

    if (!result.ok && result.status === 429 && result.retryAfterSec) {
      const waitSec = this._markTokenRateLimited(row.id, result.retryAfterSec);
      this.client.logger.info(
        { channelId, slot: row.slot, waitSec, code: result.code },
        'Rate limit — aguardando retry'
      );
      await sleep(waitSec * 1000 + 500);
      result = await sendChannelMessageAsUser(channelId, token, payload);
    }

    if (!result.ok && result.status === 429) {
      this._markTokenRateLimited(row.id, result.retryAfterSec || 30);
    }

    return result;
  }

  /**
   * Envia no canal com todos os tokens ativos até um funcionar.
   */
  async sendToChannel(channelId, payload, tenantId = PLATFORM_TENANT_ID) {
    const blocked = this.isChannelBlocked(channelId);
    if (blocked) {
      this._lastSendError = blocked;
      return { ok: false, error: blocked, via: 'blocked', skipped: true };
    }

    const list = await this.listActive(tenantId);
    if (!list.length) {
      this._lastSendError = 'Nenhum token de usuário ativo — cadastre em /painel → Tokens';
      return { ok: false, error: this._lastSendError, via: 'none' };
    }

    const available = list.filter((row) => !this._isTokenRateLimited(row.id));
    const tryList = available.length ? available : list;

    let lastError = 'Falha ao enviar';
    let permissionFailures = 0;

    for (const row of tryList) {
      if (this._isTokenRateLimited(row.id)) continue;

      try {
        const token = await this.getDecrypted(row);
        // eslint-disable-next-line no-await-in-loop
        const result = await this._sendWithToken(channelId, token, payload, row);
        if (result.ok) {
          this._lastSendError = null;
          await prisma.userToken.update({
            where: { id: row.id },
            data: { lastUsedAt: new Date(), lastError: null }
          });
          this._invalidate();
          return { ok: true, via: 'user', tokenSlot: row.slot };
        }
        lastError = result.error;
        this.client.logger.warn(
          { channelId, slot: row.slot, error: result.error, status: result.status, code: result.code },
          'Falha envio user token'
        );
        if (result.status === 401) {
          await this.markUsed(row.id, result.error);
        } else if (isPermissionError(result)) {
          permissionFailures += 1;
          await prisma.userToken.update({
            where: { id: row.id },
            data: { lastError: String(result.error).slice(0, 200) }
          });
        } else {
          await prisma.userToken.update({
            where: { id: row.id },
            data: { lastError: String(result.error).slice(0, 200) }
          });
        }
      } catch (err) {
        lastError = err.message;
        this.client.logger.error({ err, slot: row.slot }, 'Erro sendToChannel');
      }
    }

    if (permissionFailures >= tryList.length) {
      const msg = 'Sem permissão no canal — a conta do token precisa estar no servidor com acesso ao canal';
      this._blockChannel(channelId, msg);
      lastError = msg;
      this.client.logger.warn({ channelId }, 'Canal bloqueado por falta de permissão (6h)');
    }

    this._lastSendError = lastError;

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased?.()) {
      try {
        await channel.send(payload);
        this._lastSendError = null;
        return { ok: true, via: 'bot' };
      } catch (err) {
        const code = err?.code;
        let error = err?.message || 'Falha ao enviar';
        if (code === 50013) error = 'Unauthorized';
        if (code === 50001) error = 'Falta Acesso';
        this._lastSendError = `${lastError} | Bot: ${error}`;
        return { ok: false, error: this._lastSendError, via: 'bot' };
      }
    }

    return { ok: false, error: lastError, via: 'user' };
  }

  async validatePartnerTarget(channelId, guildId, tenantId = PLATFORM_TENANT_ID) {
    const list = await this.listActive(tenantId);
    if (!list.length) {
      return {
        ok: false,
        error: 'Cadastre seu **token de usuário** em `/painel` → **Tokens** → **Adicionar Token**.'
      };
    }

    let lastErr = 'Nenhum token conseguiu acessar o canal';
    for (const row of list) {
      const token = await this.getDecrypted(row);
      // eslint-disable-next-line no-await-in-loop
      const v = await validateUserChannelAccess(channelId, guildId, token);
      if (v.ok) return { ok: true, guildName: v.guildName, tokenSlot: row.slot };
      lastErr = v.error;
    }
    return { ok: false, error: lastErr };
  }

  async listForPanel(tenantId = PLATFORM_TENANT_ID) {
    const rows = await this._safe(
      () => prisma.userToken.findMany({ where: { tenantId }, orderBy: { slot: 'asc' } }),
      []
    );
    return rows.map((r) => ({
      slot: r.slot,
      username: r.username,
      discordUserId: r.discordUserId,
      active: r.active,
      lastError: r.lastError,
      masked: maskSecret(r.discordUserId, 8)
    }));
  }
}

module.exports = { UserTokenService };
