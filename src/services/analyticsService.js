class AnalyticsService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.analyticsId = 'global';
  }

  async ensure() {
    return this.client.prisma.analytics.upsert({
      where: { id: this.analyticsId },
      create: { id: this.analyticsId },
      update: {}
    });
  }

  async setConnectedGuilds(count) {
    await this.ensure();
    return this.client.prisma.analytics.update({
      where: { id: this.analyticsId },
      data: { connectedGuilds: count }
    });
  }

  async incAds() {
    await this.ensure();
    return this.client.prisma.analytics.update({
      where: { id: this.analyticsId },
      data: { totalAds: { increment: 1 } }
    });
  }

  async incDeliveries(ok, fail) {
    await this.ensure();
    return this.client.prisma.analytics.update({
      where: { id: this.analyticsId },
      data: {
        totalDeliveries: { increment: ok },
        totalFailures: { increment: fail }
      }
    });
  }
}

module.exports = { AnalyticsService };

