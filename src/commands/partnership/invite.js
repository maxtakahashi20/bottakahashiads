const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { isNetworkAdmin } = require('../../utils/permissions');
const {
  normalizeSlug,
  buildDiscordBotInviteUrl,
  buildBrandedInviteUrl
} = require('../../utils/inviteBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription(
      `Gerar link de parceria para adicionar o bot (${BRAND.storeName} / ${BRAND.name}).`
    )
    .addStringOption((opt) =>
      opt
        .setName('slug')
        .setDescription('Nome do link (ex: takahashi-store, parceiro-rp)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('parceiro')
        .setDescription('Nome do parceiro (só para exibir no painel)')
        .setRequired(false)
    ),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(client, interaction) {
    if (!isNetworkAdmin(interaction)) {
      await interaction.editReply({
        content: 'Você não tem permissão para gerar convites de parceria.'
      });
      return;
    }

    const rawSlug = interaction.options.getString('slug');
    const partnerName = interaction.options.getString('parceiro');
    const slug = normalizeSlug(rawSlug) || BRAND.defaultInviteSlug;

    const discordUrl = buildDiscordBotInviteUrl(slug);
    const brandedUrl = buildBrandedInviteUrl(slug);

    await client.services.logs.write('invite_generated', {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      message: `Convite de parceria gerado: ${slug}`,
      meta: { slug, partnerName, brandedUrl, discordUrl }
    });

    const embed = new EmbedBuilder()
      .setColor(BRAND.color)
      .setTitle(`Convite de parceria — ${BRAND.storeName}`)
      .setDescription(
        [
          'Envie o link abaixo para o **dono/admin** do servidor parceiro.',
          'Ele abre no **navegador**, escolhe o servidor e **adiciona o bot**.',
          '',
          'Depois, no servidor dele: `/setup-ads` → **Ativar rede**.',
          '',
          partnerName ? `**Parceiro:** ${partnerName}` : null,
          `**Código do link:** \`${slug}\``
        ]
          .filter(Boolean)
          .join('\n')
      )
      .addFields(
        {
          name: 'Link da loja (recomendado)',
          value: brandedUrl
            ? `[${brandedUrl}](${brandedUrl})`
            : '_Configure `PUBLIC_BASE_URL` no .env para link personalizado._'
        },
        {
          name: 'Link direto Discord',
          value: `[Adicionar bot](${discordUrl})`
        }
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
