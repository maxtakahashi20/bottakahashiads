const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireActiveTenant } = require('../../utils/tenantContext');
const { EPHEMERAL } = require('../../utils/interaction');
const { BRAND } = require('../../config/constants');
const { DURATION_LABELS } = require('../../config/licensing');
const { fmtDate } = require('../../modules/panel/panelFormat');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Status do seu ambiente e assinatura Takahashi Ads.'),

  async execute(client, interaction) {
    const gate = await requireActiveTenant(client, interaction);
    if (!gate.ok) {
      await interaction.reply({ content: gate.error, flags: EPHEMERAL });
      return;
    }

    const { tenant, subscription } = gate.ctx;
    const cfg = await client.services.tenantConfig.get(tenant.id);
    const servers = await client.services.guildSettings.countForTenant(tenant.id);

    const embed = new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle('📊 Status do ambiente')
      .addFields(
        { name: 'Ambiente', value: tenant.displayName || tenant.id, inline: false },
        { name: 'Estado', value: tenant.status, inline: true },
        { name: 'Plano', value: DURATION_LABELS[subscription.license.duration], inline: true },
        { name: 'Expira', value: fmtDate(subscription.endsAt), inline: true },
        { name: 'Bot', value: cfg.botRunning ? 'Ligado' : 'Pausado', inline: true },
        { name: 'Servidores', value: String(servers), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: EPHEMERAL });
  }
};
