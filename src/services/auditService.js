const { prisma } = require('../database/prisma');

/**
 * Logs de auditoria SaaS (separados de LogEvent operacional).
 */
class AuditService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async write(action, { tenantId = null, actorId = null, target = null, message = null, meta = null } = {}) {
    try {
      await prisma.auditLog.create({
        data: {
          action: String(action).slice(0, 120),
          tenantId,
          actorId,
          target: target ? String(target).slice(0, 200) : null,
          message: message ? String(message).slice(0, 500) : null,
          meta: meta || undefined
        }
      });
    } catch (err) {
      this.client.logger.error({ err, action }, 'Falha audit log');
    }
  }
}

module.exports = { AuditService };
