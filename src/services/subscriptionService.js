const { prisma } = require('../database/prisma');
const { DURATION_DAYS } = require('../config/licensing');

class SubscriptionService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  durationToDays(duration) {
    return DURATION_DAYS[duration] || 30;
  }

  computeEndsAt(duration, from = new Date()) {
    const days = this.durationToDays(duration);
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }

  async createFromLicense({ tenantId, licenseId, duration }) {
    const startsAt = new Date();
    const endsAt = this.computeEndsAt(duration, startsAt);
    return prisma.subscription.create({
      data: {
        tenantId,
        licenseId,
        startsAt,
        endsAt,
        status: 'ACTIVE'
      }
    });
  }

  async getActiveForTenant(tenantId) {
    return prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE', endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
      include: { license: true }
    });
  }

  async extendActive(tenantId, extraDays) {
    const sub = await this.getActiveForTenant(tenantId);
    if (!sub) {
      const last = await prisma.subscription.findFirst({
        where: { tenantId },
        orderBy: { endsAt: 'desc' }
      });
      if (!last) throw new Error('Nenhuma assinatura encontrada para este cliente.');
      const endsAt = new Date(last.endsAt.getTime() + extraDays * 24 * 60 * 60 * 1000);
      return prisma.subscription.update({
        where: { id: last.id },
        data: { endsAt, status: 'ACTIVE' }
      });
    }
    const endsAt = new Date(sub.endsAt.getTime() + extraDays * 24 * 60 * 60 * 1000);
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { endsAt, status: 'ACTIVE' }
    });
  }

  async expireSubscription(subscriptionId) {
    return prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'EXPIRED' }
    });
  }

  async listExpiringSoon(withinHours = 48) {
    const until = new Date(Date.now() + withinHours * 60 * 60 * 1000);
    return prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lte: until, gt: new Date() }
      },
      include: { tenant: true }
    });
  }

  async listExpiredActive() {
    return prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lte: new Date() }
      },
      include: { tenant: true, license: true }
    });
  }
}

module.exports = { SubscriptionService };
