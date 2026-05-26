const { env } = require('../config/env');

class LogService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async write(type, { guildId, userId, message, meta } = {}) {
    try {
      await this.client.prisma.logEvent.create({
        data: {
          type,
          guildId: guildId || null,
          userId: userId || null,
          message: message || '',
          meta: meta || undefined
        }
      });
    } catch (err) {
      this.client.logger.error({ err, type }, 'Failed to write logEvent');
    }

    if (env.logWebhookUrl) {
      // Webhook opcional (não falhar o fluxo do bot)
      try {
        await fetch(env.logWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**${type}**\n${message || ''}`,
            allowed_mentions: { parse: [] }
          })
        });
      } catch (_) {}
    }
  }
}

module.exports = { LogService };

