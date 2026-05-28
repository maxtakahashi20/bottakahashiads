const { DivulgationCycleService } = require('./divulgationCycleService');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

/**
 * Um ciclo de divulgação por tenant (isolamento SaaS).
 */
class TenantCycleManager {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    /** @type {Map<string, DivulgationCycleService>} */
    this.cycles = new Map();
  }

  get(tenantId) {
    return this.cycles.get(tenantId);
  }

  startForTenant(tenantId, opts = {}) {
    if (this.cycles.has(tenantId)) {
      const existing = this.cycles.get(tenantId);
      if (opts.burst) {
        existing
          .sendImmediate()
          .catch((err) => this.client.logger.error({ err, tenantId }, 'Burst tenant falhou'));
      }
      return existing;
    }
    const cycle = new DivulgationCycleService(this.client, tenantId);
    cycle.start(opts);
    this.cycles.set(tenantId, cycle);
    return cycle;
  }

  stopForTenant(tenantId) {
    const cycle = this.cycles.get(tenantId);
    if (cycle) {
      cycle.stop();
      cycle.runningCycle = false;
      cycle._queuedImmediate = null;
      this.cycles.delete(tenantId);
    }
  }

  async bootstrap() {
    const { SystemConfigService } = require('./systemConfigService');
    const legacy = await new SystemConfigService().get();
    const platformCfg = await this.client.services.tenantConfig.get(PLATFORM_TENANT_ID);

    if (platformCfg.botRunning || legacy.botRunning) {
      this.startForTenant(PLATFORM_TENANT_ID);
    }

    const clients = await this.client.services.tenants.listActiveClients();
    for (const t of clients) {
      const sub = await this.client.services.subscriptions.getActiveForTenant(t.id);
      if (!sub) continue;
      const cfg = await this.client.services.tenantConfig.get(t.id);
      if (cfg.botRunning) this.startForTenant(t.id);
    }
  }
}

module.exports = { TenantCycleManager };
