const { prisma } = require('../database/prisma');

class DivulgationRunService {
  async getCurrent() {
    return prisma.divulgationRun.findFirst({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' }
    });
  }

  async start(advertisementId = null) {
    const last = await prisma.divulgationRun.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true }
    });
    const number = (last?.number || 0) + 1;
    return prisma.divulgationRun.create({
      data: {
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
      orderBy: { startedAt: 'desc' },
      take: limit
    });
  }

  async clearHistory() {
    await prisma.divulgationRun.deleteMany({
      where: { status: { not: 'running' } }
    });
  }

  async getByNumber(num) {
    return prisma.divulgationRun.findFirst({ where: { number: num } });
  }
}

module.exports = { DivulgationRunService };
