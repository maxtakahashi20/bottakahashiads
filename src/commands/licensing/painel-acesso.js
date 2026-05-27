const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { deferEphemeral } = require('../../utils/interaction');
const { buildAdminAccessHome } = require('../../modules/licenses/adminAccessPanel');
const { prisma } = require('../../database/prisma');
const { dbErrorMessage } = require('../../utils/prismaSafe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel-acesso')
    .setDescription('(Dono) Painel administrativo de licenças e assinaturas.')
    // Oculta do autocomplete para usuários comuns (ainda validamos BOT_OWNER_IDS em runtime).
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(client, interaction) {
    await deferEphemeral(interaction);

    if (!isPlatformOwner(interaction)) {
      await interaction.editReply({
        content:
          '❌ Apenas o dono da plataforma pode abrir este painel.\n' +
          'Configure `BOT_OWNER_IDS` na Discloud com seu ID Discord.'
      });
      return;
    }

    try {
      const [pending, activated, tenants, recent] = await Promise.all([
        prisma.license.count({ where: { status: 'PENDING' } }),
        prisma.license.count({ where: { status: 'ACTIVATED' } }),
        prisma.tenant.count({ where: { isPlatform: false } }),
        client.services.licenses.listRecent(8)
      ]);

      const payload = buildAdminAccessHome({
        stats: { pending, activated, tenants },
        recent
      });

      await interaction.editReply(payload);
    } catch (err) {
      client.logger.error({ err }, 'painel-acesso failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}` });
    }
  }
};
