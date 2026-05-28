const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveTenantContext } = require('../../utils/tenantContext');
const { BRAND } = require('../../config/constants');
const { DURATION_LABELS } = require('../../config/licensing');
const { fmtDate } = require('../../modules/panel/panelFormat');
const { dbErrorMessage } = require('../../utils/prismaSafe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plano')
    .setDescription('Detalhes do seu plano Takahashi Ads.'),

  async execute(client, interaction) {
    try {
      const ctx = await resolveTenantContext(client, interaction);

      if (!ctx.tenant || ctx.tenant.isPlatform) {
        if (ctx.platformOwner) {
          await interaction.editReply({
            content: '👑 Você é o **dono da plataforma**. Gerencie licenças com `/painel-acesso` e `/acesso`.'
          });
          return;
        }
        await interaction.editReply({
          content: '🔑 Você ainda não possui plano. Ative com `/ativar`.'
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

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      client.logger.error({ err }, 'plano command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}` });
    }
  }
};
