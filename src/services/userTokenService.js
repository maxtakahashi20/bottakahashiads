const { prisma } = require('../database/prisma');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const {
  validateUserToken,
  sendChannelMessageAsUser,
  validateUserChannelAccess
} = require('../modules/tokens/userTokenApi');
const { maskSecret } = require('../modules/panel/panelFormat');
const { isMissingTableError } = require('../utils/prismaSafe');

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
  }

  getLastError() {
    return this._lastSendError;
  }

  _invalidate() {
    this._cache = { list: null, at: 0 };
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

  async listActive() {
    const now = Date.now();
    if (this._cache.list && now - this._cache.at < this._cacheMs) {
      return this._cache.list;
    }
    const list = await this._safe(
      () =>
        prisma.userToken.findMany({
          where: { active: true },
          orderBy: { slot: 'asc' }
        }),
      []
    );
    this._cache = { list, at: now };
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

  async addToken({ rawToken, ownerId }) {
    const profile = await validateUserToken(rawToken);
    try {
      return await this._addTokenDb({ rawToken, ownerId, profile });
    } catch (err) {
      if (isMissingTableError(err)) {
        throw new Error(
          'Tabela de tokens não existe no banco. Rode: `npx prisma db execute --file prisma/migrations/user_tokens.sql`'
        );
      }
      throw err;
    }
  }

  async _addTokenDb({ rawToken, ownerId, profile }) {
    const existing = await prisma.userToken.findFirst({
      where: { discordUserId: profile.id }
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

    const maxSlot = await prisma.userToken.aggregate({ _max: { slot: true } });
    const slot = (maxSlot._max.slot || 0) + 1;

    await prisma.userToken.create({
      data: {
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

  async removeBySlot(slot) {
    const n = Number(slot);
    const row = await prisma.userToken.findFirst({ where: { slot: n } });
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

  /**
   * Envia no canal com todos os tokens ativos até um funcionar.
   */
  async sendToChannel(channelId, payload) {
    const list = await this.listActive();
    if (!list.length) {
      this._lastSendError = 'Nenhum token de usuário ativo — cadastre em Tokens';
      return { ok: false, error: this._lastSendError, via: 'none' };
    }

    let lastError = 'Falha ao enviar';
    for (const row of list) {
      try {
        const token = await this.getDecrypted(row);
        // eslint-disable-next-line no-await-in-loop
        const result = await sendChannelMessageAsUser(channelId, token, payload);
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
          { channelId, slot: row.slot, error: result.error, status: result.status },
          'Falha envio user token'
        );
        if (result.status === 401) {
          await this.markUsed(row.id, result.error);
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

  async validatePartnerTarget(channelId, guildId) {
    const list = await this.listActive();
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

  async listForPanel() {
    const rows = await this.listAll();
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
