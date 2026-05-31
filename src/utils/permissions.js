const { PermissionFlagsBits } = require('discord.js');
const { env } = require('../config/env');

/** Dono da rede / administrador do servidor */
function isNetworkAdmin(interaction) {
  if (env.inviteOwnerIds.length && env.inviteOwnerIds.includes(interaction.user.id)) {
    return true;
  }
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) === true;
}

/** Dono da rede — tokens de usuário só por ele */
function isTokenOwner(interaction) {
  if (isPlatformOwner(interaction)) return true;
  return isNetworkAdmin(interaction);
}

/** Dono da plataforma SaaS — licenças, /acesso, /revogar */
function isPlatformOwner(interaction) {
  return env.inviteOwnerIds.length > 0 && env.inviteOwnerIds.includes(interaction.user.id);
}

/** Texto exibido ao usuário — sem citar variáveis de ambiente */
const MSG_PLATFORM_ACCESS_DENIED =
  'Comando restrito ao administrador autorizado da plataforma.';

module.exports = {
  isNetworkAdmin,
  isTokenOwner,
  isPlatformOwner,
  MSG_PLATFORM_ACCESS_DENIED
};
