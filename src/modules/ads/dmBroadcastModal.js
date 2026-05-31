const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const { DM_BROADCAST } = require('../../config/constants');

function buildIntervalField() {
  return new TextInputBuilder()
    .setCustomId('intervalo')
    .setLabel('Segundos entre cada DM (anti-spam)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3)
    .setPlaceholder(
      `Recomendado: ${DM_BROADCAST.delayRecommendedSec}s (mín. ${DM_BROADCAST.delayMinSec}, máx. ${DM_BROADCAST.delayMaxSec})`
    )
    .setValue(String(DM_BROADCAST.delayRecommendedSec));
}

function buildMessageField() {
  return new TextInputBuilder()
    .setCustomId('mensagem')
    .setLabel('Mensagem personalizada (até 4000 caracteres)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(DM_BROADCAST.messageMin)
    .setMaxLength(DM_BROADCAST.messageMax)
    .setPlaceholder('Texto, links, convite, publi… (sem @everyone / @here)');
}

/** Modal: intervalo + mensagem (amigos) */
function buildFriendsDmModal() {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_IDS.friends)
    .setTitle('DM para amigos — sua conta');

  modal.addComponents(
    new ActionRowBuilder().addComponents(buildIntervalField()),
    new ActionRowBuilder().addComponents(buildMessageField())
  );

  return modal;
}

/** Modal: ID do servidor + intervalo + mensagem */
function buildGuildDmModal() {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_IDS.guild)
    .setTitle('DM no servidor — sua conta');

  const servidorId = new TextInputBuilder()
    .setCustomId('servidor_id')
    .setLabel('ID do servidor Discord')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(20)
    .setPlaceholder('Cole o ID (você precisa estar nesse servidor)');

  modal.addComponents(
    new ActionRowBuilder().addComponents(servidorId),
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
