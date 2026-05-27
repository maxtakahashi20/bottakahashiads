const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderHome } = require('../../modules/panel/panelHandler');
const { isNetworkAdmin, isPlatformOwner } = require('../../utils/permissions');
const { EPHEMERAL } = require('../../utils/interaction');
const { resolveTenantContext } = require('../../utils/tenantContext');
const { buildTenantHome } = require('../../modules/tenants/tenantPanel');

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

    if (ctx.isActiveClient) {
      await interaction.deferReply({ flags: EPHEMERAL });
      const cfg = await client.services.tenantConfig.get(ctx.tenant.id);
      const serverCount = await client.services.guildSettings.countForTenant(ctx.tenant.id);
      const payload = buildTenantHome({
        tenant: ctx.tenant,
        subscription: ctx.subscription,
        cfg,
        serverCount
      });
      await interaction.editReply(payload);
      return;
    }

    if (isPlatformOwner(interaction) || isNetworkAdmin(interaction)) {
      await interaction.deferReply();
      const view = await renderHome(client);
      await interaction.editReply(view);
      return;
    }

    await interaction.reply({
      content: '❌ Ative sua licença com `/ativar` ou peça permissão de administrador.',
      flags: EPHEMERAL
    });
  }
};
