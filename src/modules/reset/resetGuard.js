const { resolveTenantContext } = require('../../utils/tenantContext');
const { PLATFORM_TENANT_ID } = require('../../config/licensing');

const COOLDOWN_MS = 30_000;
const PENDING_TTL_MS = 120_000;

/** @type {Map<string, number>} */
const lastUse = new Map();

/**
 * @param {import('../../structures/ExtendedClient').ExtendedClient} client
 */
function ensurePending(client) {
  if (!client._pendingResets) client._pendingResets = new Map();
}

/**
 * Apenas dono do tenant (ou dono da plataforma no tenant platform).
 */
async function requireTenantOwner(client, interaction) {
  const ctx = await resolveTenantContext(client, interaction);

  if (!ctx.tenant) {
    return {
      ok: false,
      error: '🔑 Você não possui um ambiente. Ative com `/ativar` primeiro.'
    };
  }

  const isOwner = ctx.tenant.ownerUserId === interaction.user.id;
  const isPlatformAdmin =
    ctx.platformOwner && (ctx.tenant.isPlatform || ctx.tenant.id === PLATFORM_TENANT_ID);

  if (!isOwner && !isPlatformAdmin) {
    return {
      ok: false,
      error: '❌ Apenas o **dono do ambiente** pode usar comandos de reset.'
    };
  }

  if (ctx.tenant.isPlatform && !ctx.platformOwner) {
    return { ok: false, error: '❌ Reset da plataforma é só para `BOT_OWNER_IDS`.' };
  }

  return {
    ok: true,
    ctx,
    tenantId: ctx.tenant.id,
    tenantName: ctx.tenant.displayName || ctx.tenant.id
  };
}

function checkCooldown(userId) {
  const at = lastUse.get(userId);
  if (!at) return { ok: true };
  const left = COOLDOWN_MS - (Date.now() - at);
  if (left <= 0) return { ok: true };
  return {
    ok: false,
    error: `⏳ Aguarde **${Math.ceil(left / 1000)}s** antes de outro reset.`
  };
}

function touchCooldown(userId) {
  lastUse.set(userId, Date.now());
}

function setPending(client, userId, type, tenantId) {
  ensurePending(client);
  client._pendingResets.set(userId, { type, tenantId, at: Date.now() });
}

function getPending(client, userId) {
  ensurePending(client);
  const p = client._pendingResets.get(userId);
  if (!p) return null;
  if (Date.now() - p.at > PENDING_TTL_MS) {
    client._pendingResets.delete(userId);
    return null;
  }
  return p;
}

function clearPending(client, userId) {
  ensurePending(client);
  client._pendingResets.delete(userId);
}

module.exports = {
  requireTenantOwner,
  checkCooldown,
  touchCooldown,
  setPending,
  getPending,
  clearPending,
  COOLDOWN_MS,
  PENDING_TTL_MS
};
