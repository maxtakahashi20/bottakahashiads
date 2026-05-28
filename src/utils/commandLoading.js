const { EPHEMERAL } = require('./interaction');

/** Mensagens de carregamento por comando (slash). */
const LOADING_BY_COMMAND = {
  painel: 'Carregando painel de controle…',
  'setup-ads': 'Carregando configuração de anúncios…',
  ativar: 'Processando ativação da licença…',
  renovar: 'Processando renovação do plano…',
  revogar: 'Processando revogação da licença…',
  licenses: 'Carregando lista de licenças…',
  acesso: 'Gerando licença de acesso…',
  'painel-acesso': 'Carregando painel administrativo…',
  status: 'Carregando status do ambiente…',
  plano: 'Carregando detalhes do plano…',
  rede: 'Carregando painel da rede…',
  invite: 'Gerando link de convite…',
  'reset-geral': 'Preparando confirmação de reset geral…',
  'reset-token': 'Preparando confirmação de reset de tokens…',
  'reset-servidores': 'Preparando confirmação de reset de servidores…',
  'reset-ciclos': 'Preparando confirmação de reset de ciclos…'
};

const DEFAULT_LOADING = 'Carregando comando…';

function getCommandLoadingMessage(commandName) {
  const label = LOADING_BY_COMMAND[commandName] || DEFAULT_LOADING;
  return `⏳ **${label}**\nAguarde um momento.`;
}

function shouldSkipCommandLoading(cmd) {
  return cmd?.skipCommandLoading === true || cmd?.usesModal === true;
}

/**
 * Defer + mensagem ephemeral de carregamento (slash commands).
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 */
async function beginCommandLoading(interaction, commandName) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ flags: EPHEMERAL });
  await interaction.editReply({
    content: getCommandLoadingMessage(commandName),
    embeds: [],
    components: []
  });
}

module.exports = {
  LOADING_BY_COMMAND,
  getCommandLoadingMessage,
  shouldSkipCommandLoading,
  beginCommandLoading
};
