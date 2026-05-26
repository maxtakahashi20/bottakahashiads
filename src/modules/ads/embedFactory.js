const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { BRAND } = require('../../config/constants');

function buildAdEmbed({
  title,
  description,
  bannerUrl,
  inviteUrl,
  category,
  guildName,
  guildIconUrl,
  highlight
}) {
  const embed = new EmbedBuilder()
    .setColor(highlight ? BRAND.accent : BRAND.color)
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: 'Categoria', value: `\`${category}\``, inline: true },
      { name: 'Servidor', value: guildName ? `\`${guildName}\`` : '`Desconhecido`', inline: true }
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date());

  if (guildIconUrl) embed.setThumbnail(guildIconUrl);
  if (bannerUrl) embed.setImage(bannerUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('Entrar no Servidor')
      .setURL(inviteUrl)
  );

  return { embed, components: [row] };
}

module.exports = { buildAdEmbed };

