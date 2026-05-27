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
  if (isPlatformOwner(interaction)) return true;
  return isNetworkAdmin(interaction);
}

/** Dono da plataforma SaaS — licenças, /acesso, /revogar */
function isPlatformOwner(interaction) {
  return env.inviteOwnerIds.length > 0 && env.inviteOwnerIds.includes(interaction.user.id);
}

module.exports = { isNetworkAdmin, isTokenOwner, isPlatformOwner };
