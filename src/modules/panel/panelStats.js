const { SystemConfigService } = require('../../services/systemConfigService');
const { DivulgationRunService } = require('../../services/divulgationRunService');

const CACHE_MS = 25_000;

let divRunsCache = { runs: null, current: null, at: 0 };
const DIV_TTL = 15_000;

async function getDivulgationSnapshot(client) {
  if (divRunsCache.runs && Date.now() - divRunsCache.at < DIV_TTL) {
    return { recentRuns: divRunsCache.runs, currentRun: divRunsCache.current };
  }
  const divRuns = new DivulgationRunService();
  const [currentRun, recentRuns] = await Promise.all([
    divRuns.getCurrent(),
    divRuns.listRecent(5)
  ]);
  divRunsCache = { runs: recentRuns, current: currentRun, at: Date.now() };
  return { recentRuns, currentRun };
}

function invalidateDivulgationCache() {
  divRunsCache = { runs: null, current: null, at: 0 };
}

async function collectPanelStats(client, { force = false, tenantId } = {}) {
  const { PLATFORM_TENANT_ID, isPlatformScope } = require('./panelScope');
  const tid = tenantId || PLATFORM_TENANT_ID;

  const now = Date.now();
  const cacheKey = `${tid}:${force}`;
  if (!force && client.panelStatsCache?.data && client.panelStatsCache.tenantId === tid && now - client.panelStatsCache.at < CACHE_MS) {
    return client.panelStatsCache.data;
  }

  const systemConfig = new SystemConfigService();
  const tokenSvc = client.services.userTokens;
  const divRuns = new DivulgationRunService(tid);

  const [cfg, currentRun, recentRuns, tokenCount, configuredServers] = await Promise.all([
    isPlatformScope(tid) ? systemConfig.get() : client.services.tenantConfig.get(tid),
    divRuns.getCurrent(),
    divRuns.listRecent(5),
    tokenSvc?.countActive(tid) ?? 0,
    client.services.partnerships.countConfigured(tid)
  ]);

  let errorsTotal = recentRuns.reduce((a, r) => a + r.errorsCount, 0) + (currentRun?.errorsCount || 0);

  if (force) {
    const adsAgg = await client.prisma.advertisement.aggregate({
      _sum: { failedCount: true },
      _count: true
    });
    errorsTotal += adsAgg._sum.failedCount || 0;
  }

  const stats = {
    cfg,
    currentRun,
    recentRuns,
    partnerCount: client.guilds.cache.size,
    configuredServers,
    tokenCount,
    totalDivulgations: recentRuns.length ? Math.max(...recentRuns.map((r) => r.number)) : 0,
    totalCycles: cfg.totalCycles,
    errorsTotal,
    adsCount: recentRuns.length ? Math.max(...recentRuns.map((r) => r.number)) : 0,
    botRunning: cfg.botRunning,
    lastSendAt: cfg.lastSendAt
  };

  client.panelStatsCache = { data: stats, at: now, tenantId: tid };
  return stats;
}

module.exports = {
  collectPanelStats,
  CACHE_MS,
  invalidateDivulgationCache
};
