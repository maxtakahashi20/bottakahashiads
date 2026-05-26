const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

function buildAnnounceModal() {
  const modal = new ModalBuilder()
    .setCustomId('ads:announce:modal')
    .setTitle('Takahashi Network — Novo Anúncio');

  const title = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Título')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(80)
    .setRequired(true)
    .setPlaceholder('Ex: [FiveM] Cidade RP — Vagas para facções');

  const description = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Descrição')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(900)
    .setRequired(true)
    .setPlaceholder('Explique o diferencial do seu servidor/comunidade...');

  const bannerUrl = new TextInputBuilder()
    .setCustomId('bannerUrl')
    .setLabel('Imagem/Banner (URL opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('https://...');

  const inviteUrl = new TextInputBuilder()
    .setCustomId('inviteUrl')
    .setLabel('Link de convite')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('https://discord.gg/seuconvite');

  const category = new TextInputBuilder()
    .setCustomId('category')
    .setLabel('Categoria')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(40)
    .setPlaceholder('FIVEM, LOJA, RP, GAMING...');

  modal.addComponents(
    new ActionRowBuilder().addComponents(title),
    new ActionRowBuilder().addComponents(description),
    new ActionRowBuilder().addComponents(bannerUrl),
    new ActionRowBuilder().addComponents(inviteUrl),
    new ActionRowBuilder().addComponents(category)
  );

  return modal;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Criar um anúncio para divulgar na Takahashi Network.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(_client, interaction) {
    // Abre o modal na hora (sem await no banco) — evita "O aplicativo não respondeu"
    await interaction.showModal(buildAnnounceModal());
  }
};
