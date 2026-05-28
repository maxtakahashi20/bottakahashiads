const { SlashCommandBuilder } = require('discord.js');
const { buildConfirmPanel } = require('./resetPanels');
const { requireTenantOwner, checkCooldown, setPending } = require('./resetGuard');

/**
 * Factory para comandos slash de reset.
 * @param {'guilds'|'token'|'all'} type
 * @param {string} name
 * @param {string} description
 */
function createResetCommand(type, name, description) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .setDMPermission(false),

    /**
     * @param {import('../../structures/ExtendedClient').ExtendedClient} client
     */
    async execute(client, interaction) {
      const owner = await requireTenantOwner(client, interaction);
      if (!owner.ok) {
        await interaction.editReply({ content: owner.error });
        return;
      }

      const cd = checkCooldown(interaction.user.id);
      if (!cd.ok) {
        await interaction.editReply({ content: cd.error });
        return;
      }

      setPending(client, interaction.user.id, type, owner.tenantId);

      const panel = buildConfirmPanel(type, { tenantName: owner.tenantName });
      await interaction.editReply(panel);
    }
  };
}

module.exports = { createResetCommand };
