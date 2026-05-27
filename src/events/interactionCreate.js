const {
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js');
const { buildSetupPanel } = require('../modules/ads/setupPanel');
const { buildAdEmbed } = require('../modules/ads/embedFactory');
const { BRAND } = require('../config/constants');
const { safeReply, deferEphemeral, deferComponent } = require('../utils/interaction');
const { isNetworkAdmin } = require('../utils/permissions');
const { buildRedePanel } = require('../modules/network/redePanel');
const { handlePanelInteraction, handlePanelModal, isPanelInteraction } = require('../modules/panel/panelHandler');
const { handleTenantPanelButton } = require('../modules/tenants/tenantPanelHandler');
const { handleAdminAccessButton } = require('../modules/licenses/adminPanelHandler');
const { nextSendDate } = require('../utils/divulgationLimits');

function formatRetry(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m}min`;
}

module.exports = {
  name: 'interactionCreate',
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) {
          await safeReply(interaction, {
            content:
              '⚠️ Comando não carregado nesta instância. Faça redeploy e rode `npm run register:commands`.'
          });
          return;
        }
        await cmd.execute(client, interaction);
        return;
      }

      if (interaction.isButton()) {
        if (await handleTenantPanelButton(client, interaction)) return;
        if (await handleAdminAccessButton(client, interaction)) return;
      }

      if (
        (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
        isPanelInteraction(interaction)
      ) {
        if (interaction.isModalSubmit()) {
          const handled = await handlePanelModal(client, interaction);
          if (handled) return;
        } else {
          const handled = await handlePanelInteraction(client, interaction);
          if (handled) return;
        }
      }

      if (interaction.isChannelSelectMenu() && interaction.customId === 'ads:setup:channelSelect') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await safeReply(interaction, { content: 'Sem permissão para configurar.' });
          return;
        }
        await deferComponent(interaction);
        const channelId = interaction.values[0];
        const s = await client.services.guildSettings.update(interaction.guildId, {
          adsChannelId: channelId,
          adsEnabled: true,
          nextSendAt: nextSendDate(50)
        });
        await client.services.logs.write('setup_channel', {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          message: `Canal de divulgação: ${channelId}`
        });
        await interaction.editReply(buildSetupPanel(s));
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith('ads:rede:')) {
        if (!isNetworkAdmin(interaction)) {
          await safeReply(interaction, { content: 'Sem permissão para controlar a rede.' });
          return;
        }

        await deferComponent(interaction);

        if (interaction.customId === 'ads:rede:on') {
          await client.services.network.setEnabled(true, {
            userId: interaction.user.id,
            guildId: interaction.guildId
          });
        } else if (interaction.customId === 'ads:rede:off') {
          await client.services.network.setEnabled(false, {
            userId: interaction.user.id,
            guildId: interaction.guildId
          });
        }

        const enabled = await client.services.network.isEnabled();
        const queueSize = client.services.adsQueue.getQueueSize();
        await interaction.editReply(buildRedePanel({ enabled, queueSize }));
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith('ads:setup:')) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await safeReply(interaction, { content: 'Sem permissão para configurar.' });
          return;
        }

        if (interaction.customId === 'ads:setup:toggle') {
          await deferComponent(interaction);

          const s0 = await client.services.guildSettings.ensure(interaction.guildId);
          const s = await client.services.guildSettings.update(interaction.guildId, {
            adsEnabled: !s0.adsEnabled
          });
          await client.services.logs.write('setup_toggle', {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            message: `Ads ${s.adsEnabled ? 'ativado' : 'desativado'}`
          });
          await interaction.editReply(buildSetupPanel(s));
          return;
        }

        if (interaction.customId === 'ads:setup:cooldowns') {
          const modal = new ModalBuilder()
            .setCustomId('ads:setup:cooldownsModal')
            .setTitle('Configurar Cooldowns');

          const userCd = new TextInputBuilder()
            .setCustomId('userCooldownSec')
            .setLabel('Cooldown por usuário (segundos)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('900');

          const guildCd = new TextInputBuilder()
            .setCustomId('guildCooldownSec')
            .setLabel('Cooldown por servidor (segundos)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('900');

          modal.addComponents(
            new ActionRowBuilder().addComponents(userCd),
            new ActionRowBuilder().addComponents(guildCd)
          );
          await interaction.showModal(modal);
          return;
        }

        if (interaction.customId === 'ads:setup:categories') {
          const modal = new ModalBuilder()
            .setCustomId('ads:setup:categoriesModal')
            .setTitle('Categorias Permitidas');

          const cats = new TextInputBuilder()
            .setCustomId('allowedCategories')
            .setLabel('Categorias (separadas por vírgula)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('FIVEM, ROLEPLAY, GAMING, STORE, COMMUNITY, OTHER');

          modal.addComponents(new ActionRowBuilder().addComponents(cats));
          await interaction.showModal(modal);
          return;
        }
      }

      if (interaction.isModalSubmit() && interaction.customId === 'ads:setup:cooldownsModal') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await safeReply(interaction, { content: 'Sem permissão para configurar.' });
          return;
        }

        await deferEphemeral(interaction);

        const userCooldownSec = Number(interaction.fields.getTextInputValue('userCooldownSec'));
        const guildCooldownSec = Number(interaction.fields.getTextInputValue('guildCooldownSec'));

        const clamp = (n) => Math.min(86_400, Math.max(10, Number.isFinite(n) ? n : 900));
        const s = await client.services.guildSettings.update(interaction.guildId, {
          userCooldownSec: clamp(userCooldownSec),
          guildCooldownSec: clamp(guildCooldownSec)
        });

        await client.services.logs.write('setup_cooldowns', {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          message: `Cooldowns atualizados: user=${s.userCooldownSec}s guild=${s.guildCooldownSec}s`
        });

        await interaction.editReply({ content: '✅ Cooldowns atualizados.' });
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === 'ads:setup:categoriesModal') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await safeReply(interaction, { content: 'Sem permissão para configurar.' });
          return;
        }

        await deferEphemeral(interaction);

        const raw = interaction.fields.getTextInputValue('allowedCategories') || '';
        const parsed = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const allowedCategories = client.services.guildSettings.normalizeCategories(parsed);

        await client.services.guildSettings.update(interaction.guildId, {
          allowedCategories
        });

        await client.services.logs.write('setup_categories', {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          message: `Categorias permitidas: ${allowedCategories.join(', ') || '(nenhuma)'}`
        });

        await interaction.editReply({ content: '✅ Categorias atualizadas.' });
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === 'ads:announce:modal') {
        await deferEphemeral(interaction);

        if (!(await client.services.network.isEnabled())) {
          await interaction.editReply({
            content:
              '🔴 A **rede está desligada**. Nenhum anúncio será enviado. Use `/rede` → **Ligar rede** para reativar.'
          });
          return;
        }

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const raw = {
          title: interaction.fields.getTextInputValue('title'),
          description: interaction.fields.getTextInputValue('description'),
          bannerUrl: interaction.fields.getTextInputValue('bannerUrl') || '',
          inviteUrl: interaction.fields.getTextInputValue('inviteUrl'),
          category: interaction.fields.getTextInputValue('category')
        };

        const v = client.services.antiSpam.validateAndNormalizeAdInput(raw);
        if (!v.ok) {
          await interaction.editReply({ content: `❌ ${v.error}` });
          return;
        }

        const { title, description, bannerUrl, inviteUrl, category } = v.data;

        await client.services.blacklist.warm();

        const [settings, userBlocked, guildBlocked, premium] = await Promise.all([
          client.services.guildSettings.ensure(guildId),
          client.services.blacklist.isBlacklisted('user', userId),
          client.services.blacklist.isBlacklisted('guild', guildId),
          client.services.premium.getGuildPremium(guildId)
        ]);

        if (userBlocked) {
          await interaction.editReply({ content: 'Você está bloqueado de anunciar.' });
          return;
        }
        if (guildBlocked) {
          await interaction.editReply({ content: 'Este servidor está bloqueado na rede.' });
          return;
        }
        if (!settings.adsEnabled) {
          await interaction.editReply({
            content:
              'Este servidor não está ativo na rede. Use `/setup-ads` e clique em **Ativar rede**.'
          });
          return;
        }

        const allowed = (settings.allowedCategories || []).map((c) => String(c));
        if (allowed.length && !allowed.includes(category)) {
          await interaction.editReply({
            content: `Categoria não permitida neste servidor. Permitidas: ${allowed
              .map((c) => `\`${c}\``)
              .join(' ')}`
          });
          return;
        }

        const cd = await client.services.antiSpam.checkCooldown({
          guildId,
          userId,
          userCooldownSec: settings.userCooldownSec,
          guildCooldownSec: settings.guildCooldownSec
        });
        if (!cd.ok) {
          await interaction.editReply({
            content: `⏳ Cooldown ativo (${cd.scope}). Tente novamente em **${formatRetry(cd.retryAfterMs)}**.`
          });
          return;
        }

        const activePremium = client.services.premium.isActive(premium);

        const targets = await client.services.partnerships.listNetworkTargets({
          excludeGuildId: guildId
        });

        const safeTargets = targets.filter(
          (t) => !client.services.blacklist.isBlockedSync('guild', t.guildId)
        );

        const ad = await client.prisma.advertisement.create({
          data: {
            guildId,
            userId,
            title,
            description,
            bannerUrl: bannerUrl || null,
            inviteUrl,
            category,
            sanitized: true
          }
        });

        const guild = interaction.guild;
        const guildIconUrl = guild?.iconURL?.({ size: 128 });
        const { embed, components } = buildAdEmbed({
          title,
          description,
          bannerUrl: bannerUrl || null,
          inviteUrl,
          category,
          guildName: guild?.name,
          guildIconUrl,
          highlight: activePremium && Boolean(premium?.highlightAds)
        });

        const priority = client.services.premium.priorityScore(premium);
        client.services.adsQueue.enqueue({
          advertisementId: ad.id,
          embed,
          components,
          targets: safeTargets,
          priority
        });

        const preview = new EmbedBuilder(embed.toJSON())
          .setColor(BRAND.color)
          .setAuthor({ name: 'Prévia do seu anúncio' });

        const botTotal = client.services.partnerships.getBotGuildCount();
        const targetNames = safeTargets
          .map((t) => t.guildName || 'Servidor')
          .slice(0, 8)
          .join(', ');

        let statusMsg = `✅ Anúncio enfileirado! Será publicado no **canal de divulgação** de **${safeTargets.length}** servidor(es) parceiro(s).`;
        if (targetNames) statusMsg += `\n📡 **Destinos:** ${targetNames}`;
        statusMsg += `\n🤖 Bot está em **${botTotal}** servidor(es) (o servidor atual não recebe o próprio anúncio).`;
        if (safeTargets.length === 0 && botTotal > 1) {
          statusMsg +=
            '\n⚠️ Nenhum parceiro com canal configurado. Use `/setup-ads` ou `/painel` → **Servidores** → **Adicionar Servidor**.';
        }

        await interaction.editReply({
          content: statusMsg,
          embeds: [preview]
        });

        client.services.analytics.incAds().catch((err) => {
          client.logger.error({ err }, 'analytics.incAds failed');
        });
        client.services.logs
          .write('ad_created', {
            guildId,
            userId,
            message: `Anúncio criado: ${ad.id}`,
            meta: { category, premium: activePremium, targets: safeTargets.length }
          })
          .catch((err) => {
            client.logger.error({ err }, 'log ad_created failed');
          });
      }
    } catch (err) {
      client.logger.error({ err }, 'interactionCreate error');
      if (interaction.isRepliable()) {
        try {
          await safeReply(interaction, {
            content: 'Ocorreu um erro ao processar sua ação. Tente novamente.'
          });
        } catch (_) {}
      }
    }
  }
};
