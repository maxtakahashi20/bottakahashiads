const { prisma } = require('../database/prisma');
const { DIVULGATION } = require('../config/constants');
const { PLATFORM_TENANT_ID } = require('../config/licensing');
const { DEFAULT_SETTINGS } = require('../modules/tenants/tenantProvisioner');

const cache = new Map();
const TTL_MS = 45_000;

/**
 * Configurações por tenant (substitui SystemConfig para clientes SaaS).
 */
class TenantConfigService {
  async get(tenantId) {
    const key = tenantId || PLATFORM_TENANT_ID;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.row;

    let row = await prisma.tenantSettings.findUnique({ where: { tenantId: key } });
    if (!row && key === PLATFORM_TENANT_ID) {
      const legacy = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      if (legacy) {
        row = {
          tenantId: key,
          botRunning: legacy.botRunning,
          globalMessage: legacy.globalMessage,
          globalBannerUrl: legacy.globalBannerUrl,
          globalInviteUrl: legacy.globalInviteUrl,
          messagesPerCycle: legacy.messagesPerCycle,
          delayMsgMinSec: legacy.delayMsgMinSec,
          delayMsgMaxSec: legacy.delayMsgMaxSec,
          delayGuildMinSec: legacy.delayGuildMinSec,
          delayGuildMaxSec: legacy.delayGuildMaxSec,
          minCycleMinutes: legacy.minCycleMinutes,
          totalCycles: legacy.totalCycles,
          scheduledAt: legacy.scheduledAt,
          lastSendAt: legacy.lastSendAt,
          networkEnabled: true
        };
      }
    }
    if (!row) {
      row = await prisma.tenantSettings.create({
        data: { tenantId: key, ...DEFAULT_SETTINGS, minCycleMinutes: DIVULGATION.minIntervalMinutes }
      });
    }
    cache.set(key, { row, at: Date.now() });
    return row;
  }

  async update(tenantId, data) {
    const key = tenantId || PLATFORM_TENANT_ID;
    const row = await prisma.tenantSettings.upsert({
      where: { tenantId: key },
      create: { tenantId: key, ...DEFAULT_SETTINGS, ...data },
      update: data
    });
    cache.set(key, { row, at: Date.now() });

    if (key === PLATFORM_TENANT_ID) {
      const { SystemConfigService } = require('./systemConfigService');
      const sys = new SystemConfigService();
      const patch = {};
      for (const k of Object.keys(data)) {
        if (k !== 'networkEnabled') patch[k] = data[k];
      }
      if (Object.keys(patch).length) await sys.update(patch);
    }
    return row;
  }

  invalidate(tenantId) {
    cache.delete(tenantId || PLATFORM_TENANT_ID);
  }
}

module.exports = { TenantConfigService };
