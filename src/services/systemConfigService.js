const { prisma } = require('../database/prisma');
const { DIVULGATION } = require('../config/constants');

const DEFAULTS = {
  botRunning: true,
  messagesPerCycle: 1,
  delayMsgMinSec: 2,
  delayMsgMaxSec: 5,
  delayGuildMinSec: 15,
  delayGuildMaxSec: 35,
  minCycleMinutes: DIVULGATION.minIntervalMinutes,
  totalCycles: 0
};

let memCache = { row: null, at: 0 };
const MEM_TTL_MS = 45_000;

function invalidateSystemConfigCache() {
  memCache = { row: null, at: 0 };
}

class SystemConfigService {
  async get() {
    if (memCache.row && Date.now() - memCache.at < MEM_TTL_MS) {
      return memCache.row;
    }
    let row = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
    if (!row) {
      row = await prisma.systemConfig.create({ data: { id: 'global', ...DEFAULTS } });
    }
    memCache = { row, at: Date.now() };
    return row;
  }

  async update(data) {
    const row = await prisma.systemConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...DEFAULTS, ...data },
      update: data
    });
    memCache = { row, at: Date.now() };
    return row;
  }

  async incrementCycles(n = 1) {
    const cfg = await this.get();
    return this.update({ totalCycles: cfg.totalCycles + n });
  }

  async touchLastSend() {
    return this.update({ lastSendAt: new Date() });
  }
}

module.exports = { SystemConfigService, invalidateSystemConfigCache };
