const { PermissionFlagsBits } = require('discord.js');
const { env } = require('../config/env');

/** Dono da rede / administrador do servidor */
function isNetworkAdmin(interaction) {
  if (env.inviteOwnerIds.length && env.inviteOwnerIds.includes(interaction.user.id)) {
    return true;
  }
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) === true;
}

/** Dono da rede (BOT_OWNER_IDS) — tokens de usuário só por ele */
function isTokenOwner(interaction) {
  if (env.inviteOwnerIds.length && env.inviteOwnerIds.includes(interaction.user.id)) {
    return true;
  }
  return isNetworkAdmin(interaction);
}

module.exports = { isNetworkAdmin, isTokenOwner };
