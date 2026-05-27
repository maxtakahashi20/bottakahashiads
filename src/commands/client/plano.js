const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveTenantContext } = require('../../utils/tenantContext');
const { EPHEMERAL } = require('../../utils/interaction');
const { BRAND } = require('../../config/constants');
const { DURATION_LABELS } = require('../../config/licensing');
const { fmtDate } = require('../../modules/panel/panelFormat');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plano')
    .setDescription('Detalhes do seu plano Takahashi Ads.'),

  async execute(client, interaction) {
    const ctx = await resolveTenantContext(client, interaction);

    if (!ctx.tenant || ctx.tenant.isPlatform) {
      await interaction.reply({
        content: '🔑 Você ainda não possui plano. Ative com `/ativar`.',
        flags: EPHEMERAL
      });
      return;
    }

    const sub =
      ctx.subscription ||
      (await client.services.subscriptions.getActiveForTenant(ctx.tenant.id));

    const embed = new EmbedBuilder()
      .setColor(BRAND.accent)
      .setTitle('💎 Seu plano')
      .setDescription(
        [
          '**Takahashi Ads SaaS** — ambiente dedicado com dados isolados.',
          '',
          sub
            ? `Plano atual: **${DURATION_LABELS[sub.license?.duration || 'MONTH_1']}**`
            : 'Sem assinatura ativa no momento.',
          sub ? `Vencimento: **${fmtDate(sub.endsAt)}**` : '',
          '',
          'Renovar: `/renovar` com código novo.',
          'Suporte: Takahashi Store.'
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setFooter({ text: BRAND.storeName })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: EPHEMERAL });
  }
};
