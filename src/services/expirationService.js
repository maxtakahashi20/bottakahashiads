const { DURATION_LABELS } = require('../config/licensing');

/**
 * Verifica assinaturas expiradas, suspende tenants e notifica donos.
 */
class ExpirationService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this._timer = null;
    this._warned = new Set();
  }

  start(intervalMs = 15 * 60_000) {
    this.stop();
    this.run().catch((err) => this.client.logger.error({ err }, 'Expiration check failed'));
    this._timer = setInterval(() => {
      this.run().catch((err) => this.client.logger.error({ err }, 'Expiration check failed'));
    }, intervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async run() {
    const expired = await this.client.services.subscriptions.listExpiredActive();
    for (const sub of expired) {
      if (!sub.tenant || sub.tenant.isPlatform) continue;
      // eslint-disable-next-line no-await-in-loop
      await this.client.services.subscriptions.expireSubscription(sub.id);
      // eslint-disable-next-line no-await-in-loop
      await this.client.services.tenants.setStatus(sub.tenantId, 'EXPIRED');
      this.client.services.tenantCycles?.stopForTenant(sub.tenantId);
      // eslint-disable-next-line no-await-in-loop
      await this.client.services.audit.write('subscription.expired', {
        tenantId: sub.tenantId,
        target: sub.id,
        message: `Plano encerrado em ${sub.endsAt.toISOString()}`
      });
      // eslint-disable-next-line no-await-in-loop
      await this._notifyOwner(sub.tenant.ownerUserId, sub.endsAt, 'expired');
    }

    const soon = await this.client.services.subscriptions.listExpiringSoon(48);
    for (const sub of soon) {
      if (!sub.tenant?.notifyExpiry || sub.tenant.isPlatform) continue;
      const key = `${sub.id}:warn`;
      if (this._warned.has(key)) continue;
      this._warned.add(key);
      // eslint-disable-next-line no-await-in-loop
      await this._notifyOwner(sub.tenant.ownerUserId, sub.endsAt, 'warning');
    }
  }

  async _notifyOwner(userId, endsAt, type) {
    try {
      const user = await this.client.users.fetch(userId);
      const dateStr = endsAt.toLocaleString('pt-BR');
      if (type === 'expired') {
        await user.send(
          [
            '⛔ **Sua licença Takahashi Ads expirou**',
            `Encerramento: **${dateStr}**`,
            '',
            'As divulgações foram pausadas. Para renovar, use `/ativar` com uma nova licença ou `/renovar`.',
            'Dúvidas: contate a Takahashi Store.'
          ].join('\n')
        );
      } else {
        await user.send(
          [
            '⚠️ **Sua licença expira em breve**',
            `Validade: **${dateStr}**`,
            '',
            'Renove com `/renovar` e um código novo antes do vencimento.'
          ].join('\n')
        );
      }
    } catch {
      this.client.logger.debug({ userId }, 'Não foi possível DM aviso de expiração');
    }
  }
}

module.exports = { ExpirationService };
