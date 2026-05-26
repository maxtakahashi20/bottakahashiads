class PremiumService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  async getGuildPremium(guildId) {
    return this.client.prisma.premium.findUnique({ where: { guildId } });
  }

  isActive(p) {
    if (!p) return false;
    if (!p.expiresAt) return p.plan !== 'NONE';
    return p.expiresAt.getTime() > Date.now() && p.plan !== 'NONE';
  }

  priorityScore(p) {
    if (!this.isActive(p)) return 0;
    return Math.max(0, Number(p.priority || 0));
  }
}

module.exports = { PremiumService };

