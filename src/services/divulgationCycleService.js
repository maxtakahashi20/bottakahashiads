const { SystemConfigService } = require('./systemConfigService');
const { DivulgationRunService } = require('./divulgationRunService');
const { ChannelDeliveryService } = require('../modules/ads/channelDeliveryService');
const { buildChannelMessagePayload } = require('../modules/ads/messagePayload');
const { canSendToGuild, nextSendDate } = require('../utils/divulgationLimits');

class DivulgationCycleService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.timer = null;
    this.runningCycle = false;
    this.delivery = new ChannelDeliveryService(client);
    this.systemConfig = new SystemConfigService();
    this.divRuns = new DivulgationRunService();
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
    const cfg = await this.systemConfig.get();
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
    if (!opts.skipNetworkCheck && !(await this.client.services.network.isEnabled())) {
      return { ok: false, sent: 0, errors: 0, reason: 'Rede desligada — use `/rede` para ligar.' };
    }

    const cfg = await this.systemConfig.get();
    let targets = await this.client.services.partnerships.listNetworkTargets({});
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
        const s = await this.client.services.guildSettings.get(t.guildId);
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
          const settings = await this.client.services.guildSettings.get(t.guildId);
          return this.buildGlobalPayload(cfg, settings);
        },
        {
          delayMsgMin: cfg.delayMsgMinSec,
          delayMsgMaxSec: cfg.delayMsgMaxSec,
          delayGuildMin: cfg.delayGuildMinSec,
          delayGuildMaxSec: cfg.delayGuildMaxSec,
          messagesPerServer: cfg.messagesPerCycle,
          onSuccess: async (t) => {
            const s = await this.client.services.guildSettings.get(t.guildId);
            await this.client.services.guildSettings.update(t.guildId, {
              nextSendAt: nextSendDate(s?.delayMinutes)
            });
          }
        }
      );

      if (sent > 0) {
        await this.divRuns.bump(run.id, { messages: sent, cycles: 1, errors });
        await this.systemConfig.incrementCycles(1);
        await this.systemConfig.touchLastSend();
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
    }
  }

  async _runCycle() {
    if (!(await this.client.services.network.isEnabled())) return;

    const cfg = await this.systemConfig.get();
    if (!cfg.botRunning) return;

    if (cfg.scheduledAt && cfg.scheduledAt.getTime() > Date.now()) return;

    const targets = await this.client.services.partnerships.listNetworkTargets({});
    const result = await this._executeDelivery(targets, cfg, { immediate: false });

    if (cfg.scheduledAt && cfg.scheduledAt.getTime() <= Date.now()) {
      await this.systemConfig.update({ scheduledAt: null });
    }

    return result;
  }
}

module.exports = { DivulgationCycleService };
