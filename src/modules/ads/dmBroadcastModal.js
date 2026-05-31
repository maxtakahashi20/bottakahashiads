const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const { DM_BROADCAST } = require('../../config/constants');

function buildTokenField() {
  return new TextInputBuilder()
    .setCustomId('token')
    .setLabel('TOKEN')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(4000)
    .setPlaceholder('Cole o token da sua conta de usuário (não use token de bot)');
}

function buildGuildIdField() {
  return new TextInputBuilder()
    .setCustomId('servidor_id')
    .setLabel('ID DISCORD')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(20)
    .setPlaceholder('ID do servidor (sua conta precisa estar nele)');
}

function buildIntervalField() {
  return new TextInputBuilder()
    .setCustomId('intervalo')
    .setLabel('Segundos em cada DM')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(4)
    .setValue(String(DM_BROADCAST.delayRecommendedSec))
    .setPlaceholder(
      `Seguro: ${DM_BROADCAST.delayRecommendedSec}s (1 min). Mín. ${DM_BROADCAST.delayMinSec}s`
    );
}

function buildMessageField() {
  return new TextInputBuilder()
    .setCustomId('mensagem')
    .setLabel('Mensagem')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(DM_BROADCAST.messageMin)
    .setMaxLength(DM_BROADCAST.messageMax)
    .setPlaceholder('Até 4000 caracteres — links, publi, convite…');
}

/** TOKEN + segundos + mensagem */
function buildFriendsDmModal() {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_IDS.friends)
    .setTitle('Enviar DM — Amigos');

  modal.addComponents(
    new ActionRowBuilder().addComponents(buildTokenField()),
    new ActionRowBuilder().addComponents(buildIntervalField()),
    new ActionRowBuilder().addComponents(buildMessageField())
  );

  return modal;
}

/** TOKEN + ID DISCORD + segundos + mensagem */
function buildGuildDmModal() {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_IDS.guild)
    .setTitle('Enviar DM — Servidor');

  modal.addComponents(
    new ActionRowBuilder().addComponents(buildTokenField()),
    new ActionRowBuilder().addComponents(buildGuildIdField()),
    new ActionRowBuilder().addComponents(buildIntervalField()),
    new ActionRowBuilder().addComponents(buildMessageField())
  );

  return modal;
}

const MODAL_IDS = {
  friends: 'ads:enviardm:friends:modal',
  guild: 'ads:enviardm:guild:modal'
};

function isDmBroadcastModalId(customId) {
  return customId === MODAL_IDS.friends || customId === MODAL_IDS.guild;
}

module.exports = {
  buildFriendsDmModal,
  buildGuildDmModal,
  MODAL_IDS,
  isDmBroadcastModalId
};
