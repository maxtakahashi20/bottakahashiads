const { PermissionFlagsBits } = require('discord.js');
const { env } = require('../config/env');

/** Dono da rede / administrador do servidor */
function isNetworkAdmin(interaction) {
  if (env.inviteOwnerIds.length && env.inviteOwnerIds.includes(interaction.user.id)) {
    return true;
  }
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) === true;
}

module.exports = { isNetworkAdmin };
