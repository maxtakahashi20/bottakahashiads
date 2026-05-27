const { CACHE_MS } = require('./panelStats');

const VIEW_TTL = {
  home: 15_000,
  message: 20_000,
  tracking: 300_000,
  cycles: 20_000,
  schedule: 20_000,
  tokens: 12_000,
  servers: 20_000,
  logs: 12_000,
  divulgations: 12_000
};

function ensure(client) {
  if (!client._panelViewCache) client._panelViewCache = new Map();
  if (!client._partnerRowsCache) client._partnerRowsCache = { rows: null, at: 0 };
}

function invalidatePanelCaches(client) {
  client.panelStatsCache = { data: null, at: 0, tenantId: null };
  client._panelViewCache = new Map();
  client._partnerRowsCacheByTenant = new Map();
  const { invalidateSystemConfigCache } = require('../../services/systemConfigService');
  invalidateSystemConfigCache();
}

function viewCacheKey(key, tenantId) {
  const { PLATFORM_TENANT_ID } = require('./panelScope');
  return `${tenantId || PLATFORM_TENANT_ID}:${key}`;
}

function getViewCache(client, key, tenantId) {
  ensure(client);
  const hit = client._panelViewCache.get(viewCacheKey(key, tenantId));
  if (!hit) return null;
  const ttl = VIEW_TTL[key] ?? CACHE_MS;
  if (Date.now() - hit.at > ttl) return null;
  return hit.payload;
}

function setViewCache(client, key, payload, tenantId) {
  ensure(client);
  client._panelViewCache.set(viewCacheKey(key, tenantId), { payload, at: Date.now() });
}

async function getPartnerServerRows(client, { force = false, tenantId } = {}) {
  const { PLATFORM_TENANT_ID } = require('./panelScope');
  const tid = tenantId || PLATFORM_TENANT_ID;
  ensure(client);
  if (!client._partnerRowsCacheByTenant) client._partnerRowsCacheByTenant = new Map();
  const c = client._partnerRowsCacheByTenant.get(tid) || { rows: null, at: 0 };
  if (!force && c.rows && Date.now() - c.at < VIEW_TTL.servers) {
    return c.rows;
  }
  const rows = await client.prisma.guildSettings.findMany({
    where: { tenantId: tid, adsChannelId: { not: null } },
    orderBy: { updatedAt: 'desc' }
  });
  client._partnerRowsCacheByTenant.set(tid, { rows, at: Date.now() });
  return rows;
}

module.exports = {
  VIEW_TTL,
  invalidatePanelCaches,
  getViewCache,
  setViewCache,
  getPartnerServerRows
};
