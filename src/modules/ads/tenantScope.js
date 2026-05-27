const { PLATFORM_TENANT_ID } = require('../../config/licensing');

/**
 * Escopo de tenant para módulo de anúncios — centraliza o tenant_id usado nas queries.
 */
function adsScope(tenantId) {
  return tenantId || PLATFORM_TENANT_ID;
}

module.exports = { adsScope, PLATFORM_TENANT_ID };
