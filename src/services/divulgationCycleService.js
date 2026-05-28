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
    this._generation = 0;
    this._deliveryPromise = null;
    this._queuedImmediate = null;
    this.delivery = new ChannelDeliveryService(client, tenantId);
    this.tenantConfig = new TenantConfigService();
    this.divRuns = new DivulgationRunService(tenantId);
  }

  _isAlive() {
    const mgr = this.client.services.tenantCycles;
    if (!mgr) return true;
    return mgr.get(this.tenantId) === this;
  }

  _isCurrentGeneration(gen) {
    return gen === this._generation && this._isAlive();
  }

  /**
   * @param {{ burst?: boolean }} opts — burst=true envia uma vez ao ligar o bot
   */
  start(opts = {}) {
    this.stop(false);
    if (opts.burst) {
      this.sendImmediate()
        .catch((err) => this.client.logger.error({ err }, 'Envio imediato ao iniciar falhou'))
        .finally(() => this._scheduleNext());
    } else {
      this._scheduleNext();
    }
  }

  /** @param {boolean} [deactivate] — invalida timers/entregas (reset/stop) */
  stop(deactivate = false) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (deactivate) {
      this._generation += 1;
      this._queuedImmediate = null;
    }
  }

  async _scheduleNext() {
    if (!this._isAlive()) return;
    const gen = this._generation;

    const cfg = await this.tenantConfig.get(this.tenantId);
    if (!cfg.botRunning || !this._isCurrentGeneration(gen)) return;

    const { clampDelayMinutes } = require('../utils/divulgationLimits');
    const cycleMin = clampDelayMinutes(cfg.minCycleMinutes);
    const ms = cycleMin * 60_000;
    this.timer = setTimeout(() => {
      if (!this._isCurrentGeneration(gen)) return;
      this._runCycle()
        .finally(() => {
          if (this._isCurrentGeneration(gen)) this._scheduleNext();
        });
    }, ms);
  }

  async buildGlobalPayload(cfg, guildSettings) {
    let embedTemplate = null;
    try {
      embedTemplate = await this.client.prisma.tenantEmbedTemplate.findUnique({
        where: { tenantId: this.tenantId }
      });
    } catch {
      /* tabela pode não existir ainda */
    }
    const preferContent = !embedTemplate?.useEmbedMode;
    return buildChannelMessagePayload(cfg, guildSettings, { preferContent, embedTemplate });
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
    if (this._deliveryPromise) {
      if (immediate) {
        this._queuedImmediate = { targets, cfg, at: Date.now() };
        return {
          ok: true,
          queued: true,
          sent: 0,
          errors: 0,
          reason: 'Envio enfileirado — aguardando ciclo atual.'
        };
      }
      return { ok: false, sent: 0, errors: 0, reason: 'Ciclo em andamento, tente em instantes.' };
    }

    const gen = this._generation;
    this.runningCycle = true;

    const runBody = async () => {
      if (!this._isCurrentGeneration(gen)) {
        return { ok: false, sent: 0, errors: 0, reason: 'Ciclo cancelado.' };
      }

      let run = await this.divRuns.getCurrent();
      if (!run) run = await this.divRuns.start();

      const toSend = [];
      for (const t of targets) {
        if (!this._isCurrentGeneration(gen)) {
          return { ok: false, sent: 0, errors: 0, reason: 'Ciclo cancelado.' };
        }
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
            try {
              const s = await this.client.services.guildSettings.get(t.guildId, this.tenantId);
              await this.client.services.guildSettings.update(
                t.guildId,
                { nextSendAt: nextSendDate(s?.delayMinutes) },
                this.tenantId
              );
            } catch (err) {
              this.client.logger.warn({ err, guildId: t.guildId }, 'Falha ao atualizar nextSendAt');
            }
          }
        }
      );

      if (!this._isCurrentGeneration(gen)) {
        return { ok: false, sent: 0, errors: 0, reason: 'Ciclo cancelado.' };
      }

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
    };

    this._deliveryPromise = runBody();
    try {
      return await this._deliveryPromise;
    } finally {
      this._deliveryPromise = null;
      this.runningCycle = false;

      if (!this._isCurrentGeneration(gen)) return;

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
