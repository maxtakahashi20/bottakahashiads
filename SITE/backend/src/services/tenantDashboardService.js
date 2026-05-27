const { prisma } = require('../lib/prisma');
const { cacheGet, cacheSet, cacheDel } = require('../lib/redis');

async function getFullTenantConfig(tenantId) {
  const cacheKey = `tenant:full:${tenantId}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return hit;

  const [settings, branding, embed, analytics, guildCount, sub] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    prisma.tenantBranding.findUnique({ where: { tenantId } }),
    prisma.tenantEmbedTemplate.findUnique({ where: { tenantId } }),
    prisma.analytics.findUnique({ where: { tenantId } }),
    prisma.guildSettings.count({ where: { tenantId, adsChannelId: { not: null } } }),
    prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE', endsAt: { gt: new Date() } },
      include: { license: true },
      orderBy: { endsAt: 'desc' }
    })
  ]);

  const payload = {
    settings,
    branding,
    embed,
    analytics,
    guildCount,
    subscription: sub
  };

  await cacheSet(cacheKey, payload, 45);
  return payload;
}

async function bumpConfigVersion(tenantId) {
  await cacheDel(`tenant:full:${tenantId}`);
}

async function getAnalyticsOverview(tenantId) {
  const [analytics, ads, deliveries, runs, guilds] = await Promise.all([
    prisma.analytics.findUnique({ where: { tenantId } }),
    prisma.advertisement.count({ where: { tenantId } }),
    prisma.adDelivery.count({
      where: { ad: { tenantId } }
    }),
    prisma.divulgationRun.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: 10
    }),
    prisma.guildSettings.count({ where: { tenantId, adsEnabled: true } })
  ]);

  const sent = await prisma.adDelivery.count({
    where: { ad: { tenantId }, status: 'sent' }
  });
  const failed = await prisma.adDelivery.count({
    where: { ad: { tenantId }, status: 'failed' }
  });

  const total = sent + failed;
  const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;

  return {
    totalAds: analytics?.totalAds ?? ads,
    totalDeliveries: analytics?.totalDeliveries ?? sent,
    totalFailures: analytics?.totalFailures ?? failed,
    connectedGuilds: analytics?.connectedGuilds ?? guilds,
    activeServers: guilds,
    successRate,
    recentRuns: runs,
    queueSize: 0
  };
}

async function getLogs(tenantId, limit = 30) {
  return prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

module.exports = {
  getFullTenantConfig,
  bumpConfigVersion,
  getAnalyticsOverview,
  getLogs
};
