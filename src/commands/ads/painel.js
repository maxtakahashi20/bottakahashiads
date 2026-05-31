const { SlashCommandBuilder } = require('discord.js');
const { renderHome } = require('../../modules/panel/panelHandler');
const { stampPanelPayload } = require('../../modules/panel/panelUpdate');
const { isNetworkAdmin, isPlatformOwner } = require('../../utils/permissions');
const { resolveTenantContext } = require('../../utils/tenantContext');
const { setPanelTenant, PLATFORM_TENANT_ID } = require('../../modules/panel/panelScope');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Painel do seu ambiente Takahashi Ads (após ativar licença).')
    .setDMPermission(false),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  async execute(client, interaction) {
    const ctx = await resolveTenantContext(client, interaction);

    const platformOwner = isPlatformOwner(interaction);
    if (platformOwner) {
      setPanelTenant(interaction.user.id, PLATFORM_TENANT_ID);
      const view = stampPanelPayload(await renderHome(client, { tenantId: PLATFORM_TENANT_ID }));
      await interaction.editReply(view);
      return;
    }

    if (ctx.isActiveClient) {
      setPanelTenant(interaction.user.id, ctx.tenant.id);
      const view = stampPanelPayload(await renderHome(client, { tenantId: ctx.tenant.id }));
      await interaction.editReply(view);
      return;
    }

    if (isNetworkAdmin(interaction)) {
      setPanelTenant(interaction.user.id, PLATFORM_TENANT_ID);
      const view = stampPanelPayload(await renderHome(client, { tenantId: PLATFORM_TENANT_ID }));
      await interaction.editReply(view);
      return;
    }

    await interaction.editReply({
      content:
        '❌ Ative sua licença com `/ativar` (filtre pelo bot **Takahashi Ads** nos comandos).\n' +
        'Administradores autorizados da plataforma utilizam o mesmo `/painel`.'
    });
  }
};
