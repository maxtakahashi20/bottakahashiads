class BlacklistService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.cache = new Map(); // key = `${type}:${id}` -> true
    this.cacheTtlMs = 60_000;
    this.lastWarm = 0;
  }

  async warm() {
    const now = Date.now();
    if (now - this.lastWarm < this.cacheTtlMs) return;
    this.lastWarm = now;
    this.cache.clear();
    const rows = await this.client.prisma.blacklist.findMany({
      select: { type: true, targetId: true }
    });
    for (const r of rows) this.cache.set(`${r.type}:${r.targetId}`, true);
  }

  async isBlacklisted(type, id) {
    await this.warm();
    return this.isBlockedSync(type, id);
  }

  isBlockedSync(type, id) {
    return this.cache.get(`${type}:${id}`) === true;
  }
}

module.exports = { BlacklistService };

