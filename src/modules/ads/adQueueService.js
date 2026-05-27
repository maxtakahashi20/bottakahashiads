const { setTimeout: delay } = require('timers/promises');
const { ChannelDeliveryService } = require('./channelDeliveryService');
const { SystemConfigService } = require('../../services/systemConfigService');
const { DivulgationRunService } = require('../../services/divulgationRunService');
const { canSendToGuild, nextSendDate } = require('../../utils/divulgationLimits');

const DELIVERY_BATCH = 100;

class AdQueueService {
  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.queue = [];
    this.running = false;
    this.delivery = new ChannelDeliveryService(client);
    this.systemConfig = new SystemConfigService();
    this.divRuns = new DivulgationRunService();
  }

  getQueueSize() {
    return this.queue.length;
  }

  clearQueue() {
    const n = this.queue.length;
    this.queue = [];
    return n;
  }

  enqueue(job) {
    this.queue.push(job);
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this._pump().catch((err) => this.client.logger.error({ err }, 'Queue pump failed'));
  }

  async _pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await this.client.services.network.isEnabled())) {
          this.clearQueue();
          this.client.logger.warn('Fila esvaziada: rede desligada');
          break;
        }

        const cfg = await this.systemConfig.get();
        if (!cfg.botRunning) {
          this.clearQueue();
          break;
        }

        const job = this.queue.shift();
        // eslint-disable-next-line no-await-in-loop
        await this._processJob(job);
      }
    } finally {
      this.running = false;
    }
  }

  async _saveDeliveries(advertisementId, guildId, channelId, ok, error) {
    await this.client.prisma.adDelivery.create({
      data: {
        advertisementId,
        targetGuildId: guildId,
        targetChannelId: channelId,
        status: ok ? 'sent' : 'failed',
        error: error || null
      }
    });
  }

  async _processJob(job) {
    if (!(await this.client.services.network.isEnabled())) {
      this.client.logger.warn({ adId: job.advertisementId }, 'Envio cancelado: rede desligada');
      return;
    }

    const cfg = await this.systemConfig.get();
    if (!cfg.botRunning) return;

    const { advertisementId, embed, components, targets } = job;
    let run = await this.divRuns.getCurrent();
    if (!run) run = await this.divRuns.start(advertisementId);

    const channelTargets = [];
    for (const t of targets) {
      if (!t.channelId) continue;
      const s = await this.client.services.guildSettings.get(t.guildId);
      if (canSendToGuild(s)) channelTargets.push(t);
    }
    let ok = 0;
    let fail = 0;

    const payloadBase = { embeds: [embed], components: components || [] };

    const { sent, errors } = await this.delivery.deliverToTargets(
      channelTargets,
      async () => payloadBase,
      {
        delayMsgMin: cfg.delayMsgMinSec,
        delayMsgMax: cfg.delayMsgMaxSec,
        delayGuildMin: cfg.delayGuildMinSec,
        delayGuildMax: cfg.delayGuildMaxSec,
        messagesPerServer: cfg.messagesPerCycle,
        onSuccess: async (t) => {
          const s = await this.client.services.guildSettings.get(t.guildId);
          await this.client.services.guildSettings.update(t.guildId, {
            nextSendAt: nextSendDate(s?.delayMinutes)
          });
          await this._saveDeliveries(advertisementId, t.guildId, t.channelId, true);
        },
        onError: async (t, err) => {
          await this._saveDeliveries(advertisementId, t.guildId, t.channelId, false, err);
        }
      }
    );

    ok = sent;
    fail = errors;

    await this.divRuns.bump(run.id, { messages: ok, cycles: 1, errors: fail });
    await this.systemConfig.incrementCycles(1);
    await this.systemConfig.touchLastSend();

    await this.client.prisma.advertisement.update({
      where: { id: advertisementId },
      data: { sentCount: ok, failedCount: fail }
    });

    await this.client.services.analytics.incDeliveries(ok, fail);
    await this.client.services.logs.write('ad_delivered', {
      message: `Entrega em canais: ok=${ok} fail=${fail} em ${channelTargets.length} servidor(es)`,
      meta: { advertisementId, ok, fail, guilds: channelTargets.length }
    });
  }
}

module.exports = { AdQueueService };
