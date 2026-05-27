const { prisma } = require('../../database/prisma');
const { isPlatformOwner } = require('../../utils/permissions');
const { deferComponent, EPHEMERAL } = require('../../utils/interaction');
const { buildAdminAccessHome, BTN } = require('./adminAccessPanel');
const { dbErrorMessage } = require('../../utils/prismaSafe');

async function handleAdminAccessButton(client, interaction) {
  const id = interaction.customId;
  if (!id.startsWith('saas:admin:')) return false;

  if (!isPlatformOwner(interaction)) {
    await interaction.reply({ content: '❌ Sem permissão.', flags: EPHEMERAL });
    return true;
  }

  if (id === BTN.LIST) {
    await deferComponent(interaction);
    try {
      const [pending, activated, tenants, recent] = await Promise.all([
        prisma.license.count({ where: { status: 'PENDING' } }),
        prisma.license.count({ where: { status: 'ACTIVATED' } }),
        prisma.tenant.count({ where: { isPlatform: false } }),
        client.services.licenses.listRecent(15)
      ]);
      const home = buildAdminAccessHome({
        stats: { pending, activated, tenants },
        recent
      });
      await interaction.editReply(home);
    } catch (err) {
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}`, embeds: [], components: [] });
    }
    return true;
  }

  const duration = id.replace('saas:admin:gen:', '');
  if (!['MONTH_1', 'MONTH_3', 'YEAR_1'].includes(duration)) return false;

  await deferComponent(interaction);

  try {
    const license = await client.services.licenses.generate({
      duration,
      createdByUserId: interaction.user.id
    });

    const [pending, activated, tenants, recent] = await Promise.all([
      prisma.license.count({ where: { status: 'PENDING' } }),
      prisma.license.count({ where: { status: 'ACTIVATED' } }),
      prisma.tenant.count({ where: { isPlatform: false } }),
      client.services.licenses.listRecent(8)
    ]);

    const home = buildAdminAccessHome({
      stats: { pending, activated, tenants },
      recent
    });

    await interaction.editReply({
      content: `✅ Nova licença:\n\`\`\`${license.code}\`\`\``,
      embeds: home.embeds,
      components: home.components
    });
  } catch (err) {
    client.logger.error({ err }, 'admin panel button failed');
    await interaction.editReply({
      content: `❌ ${dbErrorMessage(err)}`,
      embeds: [],
      components: []
    });
  }

  return true;
}

module.exports = { handleAdminAccessButton };
