class NetworkService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.analyticsId = 'global';
    this.cache = { enabled: true, at: 0 };
    this.cacheTtlMs = 2000;
  }

  async ensure() {
    return this.client.prisma.analytics.upsert({
      where: { id: this.analyticsId },
      create: { id: this.analyticsId, networkEnabled: true },
      update: {}
    });
  }

  async isEnabled() {
    const now = Date.now();
    if (now - this.cache.at < this.cacheTtlMs) return this.cache.enabled;

    const row = await this.ensure();
    const enabled = row.networkEnabled !== false;
    this.cache = { enabled, at: now };
    return enabled;
  }

  /**
   * @param {boolean} enabled
   * @param {{ userId?: string, guildId?: string }} meta
   */
  async setEnabled(enabled, meta = {}) {
    await this.client.prisma.analytics.upsert({
      where: { id: this.analyticsId },
      create: { id: this.analyticsId, networkEnabled: enabled },
      update: { networkEnabled: enabled }
    });

    this.cache = { enabled, at: Date.now() };

    if (!enabled) {
      const cleared = this.client.services.adsQueue.clearQueue();
      await this.client.services.logs.write('network_disabled', {
        guildId: meta.guildId,
        userId: meta.userId,
        message: `Rede desligada. ${cleared} job(s) removido(s) da fila.`,
        meta: { cleared }
      });
    } else {
      await this.client.services.logs.write('network_enabled', {
        guildId: meta.guildId,
        userId: meta.userId,
        message: 'Rede ligada.'
      });
    }

    return enabled;
  }
}

module.exports = { NetworkService };
