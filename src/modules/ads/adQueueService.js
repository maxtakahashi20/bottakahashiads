const { setTimeout: delay } = require('timers/promises');
const { deliverToGuildMembers } = require('./memberDmService');

const DELIVERY_BATCH = 100;

class AdQueueService {
  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.queue = [];
    this.running = false;
    this.guildDelayMs = 2000;
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

        const job = this.queue.shift();
        // eslint-disable-next-line no-await-in-loop
        await this._processJob(job);
        // eslint-disable-next-line no-await-in-loop
        await delay(this.guildDelayMs);
      }
    } finally {
      this.running = false;
    }
  }

  async _saveDeliveries(advertisementId, guildId, deliveries) {
    for (let i = 0; i < deliveries.length; i += DELIVERY_BATCH) {
      const chunk = deliveries.slice(i, i + DELIVERY_BATCH);
      // eslint-disable-next-line no-await-in-loop
      await this.client.prisma.adDelivery.createMany({
        data: chunk.map((d) => ({
          advertisementId,
          targetGuildId: guildId,
          targetChannelId: d.userId,
          status: d.status,
          error: d.error
        }))
      });
    }
  }

  async _processJob(job) {
    if (!(await this.client.services.network.isEnabled())) {
      this.client.logger.warn({ adId: job.advertisementId }, 'Envio cancelado: rede desligada');
      return;
    }

    const { advertisementId, embed, components, targets } = job;
    let ok = 0;
    let fail = 0;

    for (const t of targets) {
      const guildId = t.guildId;

      // eslint-disable-next-line no-await-in-loop
      const result = await deliverToGuildMembers(this.client, {
        guildId,
        embed,
        components
      });

      ok += result.ok;
      fail += result.fail;

      if (result.deliveries.length) {
        // eslint-disable-next-line no-await-in-loop
        await this._saveDeliveries(advertisementId, guildId, result.deliveries);
      }

      this.client.logger.info(
        { guildId, sent: result.ok, failed: result.fail, members: result.members },
        'DMs enviadas no servidor'
      );
    }

    await this.client.prisma.advertisement.update({
      where: { id: advertisementId },
      data: { sentCount: ok, failedCount: fail }
    });

    await this.client.services.analytics.incDeliveries(ok, fail);
    await this.client.services.logs.write('ad_delivered', {
      message: `Entrega DM: ok=${ok} fail=${fail} em ${targets.length} servidor(es)`,
      meta: { advertisementId, ok, fail, guilds: targets.length }
    });
  }
}

module.exports = { AdQueueService };
