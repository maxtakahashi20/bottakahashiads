const { TenantConfigService } = require('./tenantConfigService');
const { DivulgationRunService } = require('./divulgationRunService');
const { ChannelDeliveryService } = require('../modules/ads/channelDeliveryService');
const { buildChannelMessagePayload } = require('../modules/ads/messagePayload');
const { canSendToGuild, nextSendDate } = require('../utils/divulgationLimits');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

class DivulgationCycleService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   * @param {string} [tenantId]
   */
  constructor(client, tenantId = PLATFORM_TENANT_ID) {
    this.client = client;
    this.tenantId = tenantId;
    this.timer = null;
    this.runningCycle = false;
    this._queuedImmediate = null; // { guildIds, opts, at }
    this.delivery = new ChannelDeliveryService(client, tenantId);
    this.tenantConfig = new TenantConfigService();
    this.divRuns = new DivulgationRunService(tenantId);
  }

  /**
   * @param {{ burst?: boolean }} opts — burst=true envia uma vez ao ligar o bot
   */
  start(opts = {}) {
    this.stop();
    if (opts.burst) {
      this.sendImmediate()
        .catch((err) => this.client.logger.error({ err }, 'Envio imediato ao iniciar falhou'))
        .finally(() => this._scheduleNext());
    } else {
      this._scheduleNext();
    }
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async _scheduleNext() {
    const cfg = await this.tenantConfig.get(this.tenantId);
    if (!cfg.botRunning) return;

    const { clampDelayMinutes } = require('../utils/divulgationLimits');
    const cycleMin = clampDelayMinutes(cfg.minCycleMinutes);
    const ms = cycleMin * 60_000;
    this.timer = setTimeout(() => {
      this._runCycle().finally(() => this._scheduleNext());
    }, ms);
  }

  buildGlobalPayload(cfg, guildSettings) {
    return buildChannelMessagePayload(cfg, guildSettings, { preferContent: true });
  }

  /**
   * Envio imediato (configurar servidor ou ao ligar o bot).
   * @param {string[]|null} guildIds — null = todos os parceiros configurados
   * @param {{ skipNetworkCheck?: boolean }} opts
   */
  async sendImmediate(guildIds = null, opts = {}) {
    if (!opts.skipNetworkCheck && !(await this._isNetworkEnabled())) {
      return { ok: false, sent: 0, errors: 0, reason: 'Rede desligada — ative no painel.' };
    }

    const cfg = await this.tenantConfig.get(this.tenantId);
    let targets = await this.client.services.partnerships.listNetworkTargets({
      tenantId: this.tenantId
    });
    if (guildIds?.length) {
      targets = targets.filter((t) => guildIds.includes(t.guildId));
    }
    if (!targets.length) {
      return { ok: false, sent: 0, errors: 0, reason: 'Nenhum servidor com canal configurado.' };
    }

    return this._executeDelivery(targets, cfg, { immediate: true });
  }

  async _executeDelivery(targets, cfg, { immediate = false } = {}) {
    if (this.runningCycle) {
      // Se for envio manual, enfileira para rodar assim que o ciclo atual terminar.
      if (immediate) {
        this._queuedImmediate = { targets, cfg, at: Date.now() };
        return { ok: true, queued: true, sent: 0, errors: 0, reason: 'Envio enfileirado — aguardando ciclo atual.' };
      }
      return { ok: false, sent: 0, errors: 0, reason: 'Ciclo em andamento, tente em instantes.' };
    }

    this.runningCycle = true;
    let run = await this.divRuns.getCurrent();
    if (!run) run = await this.divRuns.start();

    try {
      const toSend = [];
      for (const t of targets) {
        if (!t.channelId) continue;
        if (immediate) {
          toSend.push(t);
          continue;
        }
        const s = await this.client.services.guildSettings.get(t.guildId, this.tenantId);
        if (canSendToGuild(s)) toSend.push(t);
      }

      if (!toSend.length) {
        return {
          ok: true,
          sent: 0,
          errors: 0,
          reason: immediate
            ? 'Nenhum servidor configurado com canal.'
            : 'Nenhum servidor no horário de envio (aguarde o próximo horário).'
        };
      }

      const { sent, errors, lastError } = await this.delivery.deliverToTargets(
        toSend,
        async (t) => {
          const settings = await this.client.services.guildSettings.get(t.guildId, this.tenantId);
          return this.buildGlobalPayload(cfg, settings);
        },
        {
          delayMsgMin: cfg.delayMsgMinSec,
          delayMsgMax: cfg.delayMsgMaxSec,
          delayGuildMin: cfg.delayGuildMinSec,
          delayGuildMax: cfg.delayGuildMaxSec,
          messagesPerServer: cfg.messagesPerCycle,
          onSuccess: async (t) => {
            const s = await this.client.services.guildSettings.get(t.guildId, this.tenantId);
            await this.client.services.guildSettings.update(
              t.guildId,
              { nextSendAt: nextSendDate(s?.delayMinutes) },
              this.tenantId
            );
          }
        }
      );

      if (sent > 0) {
        await this.divRuns.bump(run.id, { messages: sent, cycles: 1, errors });
        const prev = await this.tenantConfig.get(this.tenantId);
        await this.tenantConfig.update(this.tenantId, {
          totalCycles: (prev.totalCycles || 0) + 1,
          lastSendAt: new Date()
        });
      }

      if (sent === 0 && lastError) {
        this.client.logger.error({ lastError, targets: toSend.length }, 'Divulgação: 0 enviadas');
      }

      return {
        ok: sent > 0,
        sent,
        errors,
        reason: sent > 0 ? null : lastError || this.client.services.userTokens?.getLastError() || 'Erro desconhecido'
      };
    } finally {
      this.runningCycle = false;
      // Roda envio manual enfileirado (uma vez) logo após liberar o ciclo.
      const queued = this._queuedImmediate;
      this._queuedImmediate = null;
      if (queued?.targets?.length && queued?.cfg) {
        this._executeDelivery(queued.targets, queued.cfg, { immediate: true }).catch((err) =>
          this.client.logger.error({ err, tenantId: this.tenantId }, 'Queued immediate send failed')
        );
      }
    }
  }

  async _isNetworkEnabled() {
    const cfg = await this.tenantConfig.get(this.tenantId);
    if (cfg.networkEnabled === false) return false;
    if (this.tenantId === PLATFORM_TENANT_ID) {
      return this.client.services.network.isEnabled();
    }
    const sub = await this.client.services.subscriptions.getActiveForTenant(this.tenantId);
    return Boolean(sub);
  }

  async _runCycle() {
    if (!(await this._isNetworkEnabled())) return;

    const cfg = await this.tenantConfig.get(this.tenantId);
    if (!cfg.botRunning) return;

    if (cfg.scheduledAt && cfg.scheduledAt.getTime() > Date.now()) return;

    const targets = await this.client.services.partnerships.listNetworkTargets({
      tenantId: this.tenantId
    });
    const result = await this._executeDelivery(targets, cfg, { immediate: false });

    if (cfg.scheduledAt && cfg.scheduledAt.getTime() <= Date.now()) {
      await this.tenantConfig.update(this.tenantId, { scheduledAt: null });
    }

    return result;
  }
}

module.exports = { DivulgationCycleService };
