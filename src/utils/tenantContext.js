const { PLATFORM_TENANT_ID } = require('../config/licensing');
const { isPlatformOwner } = require('./permissions');

/**
 * Resolve tenant do usuário para isolamento multi-tenant.
 * @param {import('../structures/ExtendedClient').ExtendedClient} client
 * @param {import('discord.js').Interaction} interaction
 */
async function resolveTenantContext(client, interaction) {
  const userId = interaction.user.id;
  const platformOwner = isPlatformOwner(interaction);

  const tenant = await client.services.tenants.getByOwner(userId);
  let subscription = null;
  if (tenant && !tenant.isPlatform) {
    subscription = await client.services.subscriptions.getActiveForTenant(tenant.id);
  }

  const isActiveClient =
    tenant &&
    !tenant.isPlatform &&
    tenant.status === 'ACTIVE' &&
    subscription &&
    subscription.endsAt > new Date();

  return {
    userId,
    platformOwner,
    tenant,
    tenantId: isActiveClient ? tenant.id : platformOwner ? PLATFORM_TENANT_ID : tenant?.id || null,
    subscription,
    isActiveClient,
    isPlatform: platformOwner,
    usePlatformScope: platformOwner && !tenant?.isPlatform === false && !isActiveClient
  };
}

/**
 * Exige tenant ativo (comandos do cliente).
 */
async function requireActiveTenant(client, interaction) {
  const ctx = await resolveTenantContext(client, interaction);
  if (ctx.isActiveClient) return { ok: true, ctx };
  if (ctx.tenant && ctx.tenant.status === 'EXPIRED') {
    return {
      ok: false,
      error: '⛔ Seu plano expirou. Use `/ativar` ou `/renovar` com uma licença válida.'
    };
  }
  if (ctx.tenant && ctx.tenant.status === 'SUSPENDED') {
    return { ok: false, error: '⛔ Ambiente suspenso. Contate o suporte Takahashi Store.' };
  }
  return {
    ok: false,
    error: '🔑 Você ainda não ativou uma licença. Use `/ativar` com seu código.'
  };
}

function scopeTenantId(ctx, explicit) {
  if (explicit) return explicit;
  if (ctx?.isActiveClient) return ctx.tenantId;
  if (ctx?.isPlatform) return PLATFORM_TENANT_ID;
  return ctx?.tenantId || PLATFORM_TENANT_ID;
}

module.exports = { resolveTenantContext, requireActiveTenant, scopeTenantId, PLATFORM_TENANT_ID };
