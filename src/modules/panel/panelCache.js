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
  client.panelStatsCache = { data: null, at: 0 };
  client._panelViewCache = new Map();
  client._partnerRowsCache = { rows: null, at: 0 };
  const { invalidateSystemConfigCache } = require('../../services/systemConfigService');
  invalidateSystemConfigCache();
}

function getViewCache(client, key) {
  ensure(client);
  const hit = client._panelViewCache.get(key);
  if (!hit) return null;
  const ttl = VIEW_TTL[key] ?? CACHE_MS;
  if (Date.now() - hit.at > ttl) return null;
  return hit.payload;
}

function setViewCache(client, key, payload) {
  ensure(client);
  client._panelViewCache.set(key, { payload, at: Date.now() });
}

async function getPartnerServerRows(client, { force = false } = {}) {
  ensure(client);
  const c = client._partnerRowsCache;
  if (!force && c.rows && Date.now() - c.at < VIEW_TTL.servers) {
    return c.rows;
  }
  const rows = await client.prisma.guildSettings.findMany({
    where: { adsChannelId: { not: null } },
    orderBy: { updatedAt: 'desc' }
  });
  client._partnerRowsCache = { rows, at: Date.now() };
  return rows;
}

module.exports = {
  VIEW_TTL,
  invalidatePanelCaches,
  getViewCache,
  setViewCache,
  getPartnerServerRows
};
