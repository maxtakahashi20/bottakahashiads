const { buildTenantHome, BTN } = require('./tenantPanel');
const { requireActiveTenant } = require('../../utils/tenantContext');
const { deferComponent, EPHEMERAL } = require('../../utils/interaction');

async function handleTenantPanelButton(client, interaction) {
  const id = interaction.customId;
  if (!id.startsWith('saas:tenant:')) return false;

  const gate = await requireActiveTenant(client, interaction);
  if (!gate.ok) {
    await interaction.reply({ content: gate.error, flags: EPHEMERAL });
    return true;
  }

  const { tenant, subscription } = gate.ctx;
  await deferComponent(interaction);

  const cfg = await client.services.tenantConfig.get(tenant.id);

  if (id === BTN.TOGGLE_BOT) {
    await client.services.tenantConfig.update(tenant.id, { botRunning: !cfg.botRunning });
    if (!cfg.botRunning) {
      client.services.tenantCycles.startForTenant(tenant.id);
    } else {
      client.services.tenantCycles.stopForTenant(tenant.id);
    }
  }

  if (id === BTN.SEND_NOW) {
    const cycle = client.services.tenantCycles.get(tenant.id) ||
      client.services.tenantCycles.startForTenant(tenant.id);
    const send = await cycle.sendImmediate();
    const detail = send?.reason || 'Concluído.';
    if (send?.sent > 0) {
      await interaction.followUp({
        content: `🚀 **${send.sent}** mensagem(ns) enviada(s).`,
        flags: EPHEMERAL
      });
    } else {
      await interaction.followUp({ content: `⚠️ ${detail}`, flags: EPHEMERAL });
    }
  }

  const freshCfg = await client.services.tenantConfig.get(tenant.id);
  const serverCount = await client.services.guildSettings.countForTenant(tenant.id);
  const sub =
    subscription || (await client.services.subscriptions.getActiveForTenant(tenant.id));
  const payload = buildTenantHome({
    tenant,
    subscription: sub,
    cfg: freshCfg,
    serverCount
  });
  await interaction.editReply(payload);
  return true;
}

module.exports = { handleTenantPanelButton };
