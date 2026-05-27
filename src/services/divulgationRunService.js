const { prisma } = require('../database/prisma');
const { PLATFORM_TENANT_ID } = require('../config/licensing');

class DivulgationRunService {
  constructor(tenantId = PLATFORM_TENANT_ID) {
    this.tenantId = tenantId;
  }

  async getCurrent() {
    return prisma.divulgationRun.findFirst({
      where: { tenantId: this.tenantId, status: 'running' },
      orderBy: { startedAt: 'desc' }
    });
  }

  async start(advertisementId = null) {
    const last = await prisma.divulgationRun.findFirst({
      where: { tenantId: this.tenantId },
      orderBy: { number: 'desc' },
      select: { number: true }
    });
    const number = (last?.number || 0) + 1;
    return prisma.divulgationRun.create({
      data: {
        tenantId: this.tenantId,
        number,
        status: 'running',
        advertisementId
      }
    });
  }

  async bump(id, { messages = 0, cycles = 0, errors = 0 }) {
    const run = await prisma.divulgationRun.findUnique({ where: { id } });
    if (!run) return null;
    return prisma.divulgationRun.update({
      where: { id },
      data: {
        messagesSent: run.messagesSent + messages,
        cyclesDone: run.cyclesDone + cycles,
        errorsCount: run.errorsCount + errors
      }
    });
  }

  async finish(id) {
    return prisma.divulgationRun.update({
      where: { id },
      data: { status: 'completed', endedAt: new Date() }
    });
  }

  async listRecent(limit = 10) {
    return prisma.divulgationRun.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit
    });
  }

  async clearHistory() {
    await prisma.divulgationRun.deleteMany({
      where: { tenantId: this.tenantId, status: { not: 'running' } }
    });
  }

  async getByNumber(num) {
    return prisma.divulgationRun.findFirst({
      where: { tenantId: this.tenantId, number: num }
    });
  }
}

module.exports = { DivulgationRunService };
