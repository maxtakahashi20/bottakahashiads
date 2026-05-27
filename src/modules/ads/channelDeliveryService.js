const { prisma } = require('../../database/prisma');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

class ChannelDeliveryService {
  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async postToChannel(channelId, payload) {
    const tokens = this.client.services.userTokens;
    if (tokens) {
      return tokens.sendToChannel(channelId, payload);
    }

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      return { ok: false, error: 'Canal inválido ou inacessível' };
    }
    try {
      await channel.send(payload);
      return { ok: true, via: 'bot' };
    } catch (err) {
      const code = err?.code || err?.rawError?.code;
      let error = err?.message || 'Falha ao enviar';
      if (code === 50013) error = 'Unauthorized';
      if (code === 50001) error = 'Falta Acesso';
      return { ok: false, error };
    }
  }

  async deliverToTargets(targets, buildPayload, options = {}) {
    const {
      onSuccess,
      onError,
      delayMsgMin = 2,
      delayMsgMax = 5,
      delayGuildMin = 15,
      delayGuildMax = 35,
      messagesPerServer = 1
    } = options;

    let sent = 0;
    let errors = 0;
    let lastError = null;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const payload = await buildPayload(t);
      if (!payload) continue;

      for (let m = 0; m < messagesPerServer; m++) {
        const result = await this.postToChannel(t.channelId, payload);
        if (result.ok) {
          sent++;
          if (onSuccess) await onSuccess(t, result);
        } else {
          errors++;
          lastError = result.error;
          if (onError) await onError(t, result.error);
          prisma.logEvent
            .create({
              data: {
                type: 'channel_send_error',
                guildId: t.guildId,
                message: result.error,
                meta: { channelId: t.channelId, via: result.via }
              }
            })
            .catch(() => {});
        }
        if (m < messagesPerServer - 1) {
          await sleep(randomBetween(delayMsgMin, delayMsgMax) * 1000);
        }
      }

      if (i < targets.length - 1) {
        await sleep(randomBetween(delayGuildMin, delayGuildMax) * 1000);
      }
    }

    return { sent, errors, lastError };
  }
}

module.exports = { ChannelDeliveryService, sleep, randomBetween };
