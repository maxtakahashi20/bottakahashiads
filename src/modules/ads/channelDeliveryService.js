const { prisma } = require('../../database/prisma');
const { HISTORY_LIMIT, isDuplicateDmContent, buildOutboundFingerprint } = require('../../utils/dmAntiflood');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

const { PLATFORM_TENANT_ID } = require('../../config/licensing');

class ChannelDeliveryService {
  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {string} [tenantId]
   */
  constructor(client, tenantId = PLATFORM_TENANT_ID) {
    this.client = client;
    this.tenantId = tenantId;
  }

  async postToChannel(channelId, payload) {
    const tokens = this.client.services.userTokens;
    if (tokens) {
      return tokens.sendToChannel(channelId, payload, this.tenantId);
    }

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      return { ok: false, error: 'Canal inválido ou inacessível' };
    }
    try {
      const botId = this.client.user?.id;
      if (botId) {
        const messages = await channel.messages.fetch({ limit: HISTORY_LIMIT }).catch(() => null);
        if (messages) {
          const arr = [...messages.values()].map((m) => ({
            content: m.content,
            embeds: m.embeds,
            author: { id: m.author?.id }
          }));
          const text = buildOutboundFingerprint('', payload);
          if (isDuplicateDmContent(arr, text, botId).duplicate) {
            return { ok: true, via: 'bot', skipped: true, reason: 'antiflood' };
          }
        }
      }
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
    let extraBackoffMs = 0;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const payload = await buildPayload(t);
      if (!payload) continue;

      for (let m = 0; m < messagesPerServer; m++) {
        let result = await this.postToChannel(t.channelId, payload);
        if (!result.ok && result.rateLimited && result.retryAfterSec) {
          const waitMs = Math.min(90_000, Math.max(1_000, result.retryAfterSec * 1000 + 750));
          extraBackoffMs = Math.min(60_000, extraBackoffMs + 2500);
          // eslint-disable-next-line no-await-in-loop
          await sleep(waitMs);
          // eslint-disable-next-line no-await-in-loop
          result = await this.postToChannel(t.channelId, payload);
        }
        if (result.skipped) continue;
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
        const base = randomBetween(delayGuildMin, delayGuildMax) * 1000;
        const wait = base + extraBackoffMs;
        await sleep(wait);
      }
    }

    return { sent, errors, lastError };
  }
}

module.exports = { ChannelDeliveryService, sleep, randomBetween };
