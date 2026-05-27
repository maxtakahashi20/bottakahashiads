const { DIVULGATION } = require('../../config/constants');
const { PLATFORM_TENANT_ID } = require('../../config/licensing');

const DEFAULT_SETTINGS = {
  botRunning: true,
  messagesPerCycle: 1,
  delayMsgMinSec: 2,
  delayMsgMaxSec: 5,
  delayGuildMinSec: 15,
  delayGuildMaxSec: 35,
  minCycleMinutes: DIVULGATION.minIntervalMinutes,
  totalCycles: 0,
  networkEnabled: true
};

/**
 * Cria tenant + settings + analytics zerados (ambiente isolado).
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function provisionTenant(prisma, { ownerUserId, displayName }) {
  const tenant = await prisma.tenant.create({
    data: {
      ownerUserId,
      displayName: displayName || `Cliente ${ownerUserId.slice(-4)}`,
      status: 'ACTIVE',
      isPlatform: false,
      settings: { create: { ...DEFAULT_SETTINGS } },
      analytics: {
        create: {
          totalAds: 0,
          totalDeliveries: 0,
          totalFailures: 0,
          connectedGuilds: 0,
          networkEnabled: true
        }
      }
    },
    include: { settings: true }
  });
  return tenant;
}

/**
 * Garante tenant plataforma para dados legados do Takahashi Ads.
 */
async function ensurePlatformTenant(prisma, ownerUserId = 'platform-system') {
  return prisma.tenant.upsert({
    where: { id: PLATFORM_TENANT_ID },
    create: {
      id: PLATFORM_TENANT_ID,
      ownerUserId,
      displayName: 'Takahashi Ads (Plataforma)',
      status: 'ACTIVE',
      isPlatform: true,
      notifyExpiry: false,
      settings: { create: { ...DEFAULT_SETTINGS } },
      analytics: {
        create: {
          totalAds: 0,
          totalDeliveries: 0,
          totalFailures: 0,
          connectedGuilds: 0,
          networkEnabled: true
        }
      }
    },
    update: { ownerUserId, status: 'ACTIVE' }
  });
}

module.exports = { provisionTenant, ensurePlatformTenant, DEFAULT_SETTINGS };
