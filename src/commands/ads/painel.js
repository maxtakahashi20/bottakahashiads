const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderHome } = require('../../modules/panel/panelHandler');
const { isNetworkAdmin, isPlatformOwner } = require('../../utils/permissions');
const { EPHEMERAL } = require('../../utils/interaction');
const { resolveTenantContext } = require('../../utils/tenantContext');
const { setPanelTenant, PLATFORM_TENANT_ID } = require('../../modules/panel/panelScope');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Painel de controle (seu ambiente SaaS ou rede Takahashi).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  async execute(client, interaction) {
    const ctx = await resolveTenantContext(client, interaction);

    // Dono da plataforma sempre vê painel completo da rede
    if (isPlatformOwner(interaction)) {
      setPanelTenant(interaction.user.id, PLATFORM_TENANT_ID);
      await interaction.deferReply();
      const view = await renderHome(client, { tenantId: PLATFORM_TENANT_ID });
      await interaction.editReply(view);
      return;
    }

    if (ctx.isActiveClient) {
      setPanelTenant(interaction.user.id, ctx.tenant.id);
      await interaction.deferReply({ flags: EPHEMERAL });
      const view = await renderHome(client, { tenantId: ctx.tenant.id });
      await interaction.editReply(view);
      return;
    }

    if (isNetworkAdmin(interaction)) {
      setPanelTenant(interaction.user.id, PLATFORM_TENANT_ID);
      await interaction.deferReply();
      const view = await renderHome(client, { tenantId: PLATFORM_TENANT_ID });
      await interaction.editReply(view);
      return;
    }

    await interaction.reply({
      content: '❌ Ative sua licença com `/ativar` ou peça permissão de administrador.',
      flags: EPHEMERAL
    });
  }
};
