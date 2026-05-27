const { PLATFORM_TENANT_ID } = require('../../config/licensing');
const { SystemConfigService } = require('../../services/systemConfigService');
const { DivulgationRunService } = require('../../services/divulgationRunService');
const { requireActiveTenant, resolveTenantContext } = require('../../utils/tenantContext');
const { isNetworkAdmin, isPlatformOwner, isTokenOwner } = require('../../utils/permissions');
const { EPHEMERAL } = require('../../utils/interaction');

/** @type {Map<string, string>} userId -> tenantId */
const sessionTenant = new Map();

function setPanelTenant(userId, tenantId) {
  sessionTenant.set(userId, tenantId || PLATFORM_TENANT_ID);
}

function getPanelTenant(userId) {
  return sessionTenant.get(userId) || PLATFORM_TENANT_ID;
}

async function resolvePanelTenant(client, interaction) {
  const resolved = await resolveTenantContext(client, interaction);
  if (resolved.isActiveClient) {
    setPanelTenant(interaction.user.id, resolved.tenant.id);
    return resolved.tenant.id;
  }
  if (isPlatformOwner(interaction) || isNetworkAdmin(interaction)) {
    const session = getPanelTenant(interaction.user.id);
    return isPlatformScope(session) ? PLATFORM_TENANT_ID : session;
  }
  return getPanelTenant(interaction.user.id);
}

function isPlatformScope(tenantId) {
  return !tenantId || tenantId === PLATFORM_TENANT_ID;
}

/**
 * Contexto isolado do painel (plataforma ou cliente SaaS).
 */
class PanelContext {
  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {string} tenantId
   */
  constructor(client, tenantId) {
    this.client = client;
    this.tenantId = tenantId || PLATFORM_TENANT_ID;
    this.isPlatform = isPlatformScope(this.tenantId);
    this.systemConfig = new SystemConfigService();
    this.divRuns = new DivulgationRunService(this.tenantId);
  }

  async getConfig() {
    if (this.isPlatform) return this.systemConfig.get();
    return this.client.services.tenantConfig.get(this.tenantId);
  }

  async updateConfig(data) {
    if (this.isPlatform) return this.systemConfig.update(data);
    return this.client.services.tenantConfig.update(this.tenantId, data);
  }

  getCycle() {
    return (
      this.client.services.tenantCycles?.get(this.tenantId) ||
      (this.isPlatform ? this.client.services.divulgationCycle : null)
    );
  }

  startCycle({ burst = false } = {}) {
    const existing = this.client.services.tenantCycles?.get(this.tenantId);
    if (existing) {
      if (burst) existing.sendImmediate().catch(() => {});
      return existing;
    }
    if (this.client.services.tenantCycles) {
      return this.client.services.tenantCycles.startForTenant(this.tenantId, { burst });
    }
    if (this.isPlatform && this.client.services.divulgationCycle) {
      this.client.services.divulgationCycle.start({ burst });
      return this.client.services.divulgationCycle;
    }
    return null;
  }

  stopCycle() {
    this.client.services.tenantCycles?.stopForTenant(this.tenantId);
    if (this.isPlatform && this.client.services.divulgationCycle) {
      this.client.services.divulgationCycle.stop();
    }
  }

  guildSettings() {
    return this.client.services.guildSettings;
  }

  userTokens() {
    return this.client.services.userTokens;
  }
}

async function requirePanelAccess(client, interaction, tenantId) {
  if (isPlatformScope(tenantId)) {
    if (!isNetworkAdmin(interaction)) {
      const payload = {
        content: '❌ Sem permissão. Apenas administradores da rede podem usar o painel.',
        embeds: [],
        components: []
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply({ ...payload, flags: EPHEMERAL });
      }
      return false;
    }
    return true;
  }

  const gate = await requireActiveTenant(client, interaction);
  if (!gate.ok) {
    const payload = { content: gate.error, embeds: [], components: [] };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, flags: EPHEMERAL });
    }
    return false;
  }
  return true;
}

async function requireTokenAccessForPanel(client, interaction, tenantId) {
  if (isPlatformScope(tenantId)) return isTokenOwner(interaction);
  if (isPlatformOwner(interaction)) return true;
  const gate = await requireActiveTenant(client, interaction);
  if (!gate.ok) return false;
  return gate.ctx.tenant.ownerUserId === interaction.user.id;
}

module.exports = {
  PLATFORM_TENANT_ID,
  setPanelTenant,
  getPanelTenant,
  isPlatformScope,
  PanelContext,
  resolvePanelTenant,
  requirePanelAccess,
  requireTokenAccessForPanel
};
