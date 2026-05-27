const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { EPHEMERAL, deferEphemeral } = require('../../utils/interaction');
const { buildAdminAccessHome } = require('../../modules/licenses/adminAccessPanel');
const { prisma } = require('../../database/prisma');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel-acesso')
    .setDescription('(Dono) Painel administrativo de licenças e assinaturas.'),

  async execute(client, interaction) {
    if (!isPlatformOwner(interaction)) {
      await interaction.reply({
        content: '❌ Apenas o dono da plataforma pode abrir este painel.',
        flags: EPHEMERAL
      });
      return;
    }

    await deferEphemeral(interaction);

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
  }
};
