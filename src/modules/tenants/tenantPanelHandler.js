const { buildTenantHome, BTN } = require('./tenantPanel');
const { PANEL } = require('../panel/panelIds');
const { setPanelTenant } = require('../panel/panelScope');
const { requireActiveTenant } = require('../../utils/tenantContext');
const { handlePanelInteraction } = require('../panel/panelHandler');

const LEGACY_MAP = {
  [BTN.REFRESH]: PANEL.REFRESH,
  [BTN.TOGGLE_BOT]: PANEL.STOP,
  [BTN.SEND_NOW]: PANEL.SERVER_SEND_NOW
};

async function handleTenantPanelButton(client, interaction) {
  const id = interaction.customId;
  if (!id.startsWith('saas:tenant:')) return false;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }

  const gate = await requireActiveTenant(client, interaction);
  if (!gate.ok) {
    await interaction.editReply({ content: gate.error, embeds: [], components: [] });
    return true;
  }

  setPanelTenant(interaction.user.id, gate.ctx.tenant.id);

  if (LEGACY_MAP[id]) {
    return handlePanelInteraction(client, interaction, LEGACY_MAP[id]);
  }

  return handlePanelInteraction(client, interaction);
}

module.exports = { handleTenantPanelButton, buildTenantHome, BTN };
