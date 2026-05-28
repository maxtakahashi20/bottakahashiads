const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveTenantContext } = require('../../utils/tenantContext');
const { BRAND } = require('../../config/constants');
const { DURATION_LABELS } = require('../../config/licensing');
const { fmtDate } = require('../../modules/panel/panelFormat');
const { dbErrorMessage } = require('../../utils/prismaSafe');
const { prisma } = require('../../database/prisma');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Status do seu ambiente e assinatura Takahashi Ads.'),

  async execute(client, interaction) {
    try {
      const ctx = await resolveTenantContext(client, interaction);

      if (ctx.isActiveClient) {
        const { tenant, subscription } = ctx;
        const cfg = await client.services.tenantConfig.get(tenant.id);
        const servers = await client.services.guildSettings.countForTenant(tenant.id);

        const embed = new EmbedBuilder()
          .setColor(BRAND.color)
          .setTitle('📊 Status do ambiente')
          .addFields(
            { name: 'Ambiente', value: tenant.displayName || tenant.id, inline: false },
            { name: 'Estado', value: tenant.status, inline: true },
            {
              name: 'Plano',
              value: DURATION_LABELS[subscription.license?.duration] || '—',
              inline: true
            },
            { name: 'Expira', value: fmtDate(subscription.endsAt), inline: true },
            { name: 'Bot', value: cfg.botRunning ? 'Ligado' : 'Pausado', inline: true },
            { name: 'Servidores', value: String(servers), inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (ctx.platformOwner) {
        const [pending, activated, tenants] = await Promise.all([
          prisma.license.count({ where: { status: 'PENDING' } }).catch(() => 0),
          prisma.license.count({ where: { status: 'ACTIVATED' } }).catch(() => 0),
          prisma.tenant.count({ where: { isPlatform: false } }).catch(() => 0)
        ]);

        const embed = new EmbedBuilder()
          .setColor(BRAND.accent)
          .setTitle('📊 Status — Plataforma Takahashi')
          .setDescription('Você é o **dono da plataforma**. Use `/painel-acesso` e `/acesso`.')
          .addFields(
            { name: 'Licenças pendentes', value: String(pending), inline: true },
            { name: 'Licenças ativas', value: String(activated), inline: true },
            { name: 'Clientes SaaS', value: String(tenants), inline: true },
            { name: 'Servidores bot', value: String(client.guilds.cache.size), inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (ctx.tenant?.status === 'EXPIRED') {
        await interaction.editReply({
          content: '⛔ Seu plano expirou. Use `/ativar` ou `/renovar` com uma licença válida.'
        });
        return;
      }
      if (ctx.tenant?.status === 'SUSPENDED') {
        await interaction.editReply({
          content: '⛔ Ambiente suspenso. Contate o suporte Takahashi Store.'
        });
        return;
      }

      await interaction.editReply({
        content: '🔑 Você ainda não ativou uma licença. Use `/ativar` com seu código.'
      });
    } catch (err) {
      client.logger.error({ err }, 'status command failed');
      await interaction.editReply({ content: `❌ ${dbErrorMessage(err)}` });
    }
  }
};
