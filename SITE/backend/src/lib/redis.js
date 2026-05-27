const Redis = require('ioredis');
const { env } = require('../config/env');

let client = null;

function getRedis() {
  if (client) return client;
  try {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true
    });
    client.on('error', () => {});
  } catch {
    client = null;
  }
  return client;
}

async function cacheGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    if (r.status !== 'ready') await r.connect().catch(() => null);
    const v = await r.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSec = 60) {
  const r = getRedis();
  if (!r) return;
  try {
    if (r.status !== 'ready') await r.connect().catch(() => null);
    await r.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    /* ignore */
  }
}

async function cacheDel(pattern) {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch {
    /* ignore */
  }
}

module.exports = { getRedis, cacheGet, cacheSet, cacheDel };
