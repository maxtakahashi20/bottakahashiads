const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { BTN } = require('./resetIds');

const TITLES = {
  guilds: 'Reset de Servidores',
  token: 'Reset de Token',
  all: 'Reset Geral'
};

const DESCRIPTIONS = {
  guilds: [
    '• Remove **todos os servidores** configurados no seu ambiente',
    '• Limpa canais de divulgação e parcerias',
    '• Limpa cache do painel',
    '',
    'Você precisará configurar servidores novamente em `/painel` → **Servidores**.'
  ].join('\n'),
  token: [
    '• Remove **todos os tokens** de usuário salvos',
    '• Limpa cache e bloqueios de envio',
    '• Desativa sessões de envio por conta',
    '',
    'Você precisará adicionar um novo token em `/painel` → **Tokens**.'
  ].join('\n'),
  all: [
    '• Remove tokens e servidores',
    '• Zera configurações, embeds e mensagens globais',
    '• Limpa analytics, divulgações, fila e cache',
    '• Para o bot de divulgação do seu ambiente',
    '',
    'Sua conta ficará **completamente zerada** (licença permanece ativa).'
  ].join('\n')
};

function buildConfirmPanel(type, { tenantName }) {
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(`⚠️ ${TITLES[type]}`)
    .setDescription(
      [
        `**Ambiente:** ${tenantName}`,
        '',
        DESCRIPTIONS[type],
        '',
        '⚠️ **Essa ação é irreversível.**',
        'Confirme apenas se tiver certeza.'
      ].join('\n')
    )
    .setFooter({ text: `${BRAND.storeName} • Reset administrativo` })
    .setTimestamp();

  const confirmId = type === 'guilds' ? BTN.confirmGuilds : type === 'token' ? BTN.confirmToken : BTN.confirmAll;
  const cancelId = type === 'guilds' ? BTN.cancelGuilds : type === 'token' ? BTN.cancelToken : BTN.cancelAll;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel('Confirmar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildResultEmbed(type, result) {
  const ok = result.ok !== false;
  const embed = new EmbedBuilder()
    .setColor(ok ? BRAND.accent : 0xef4444)
    .setTitle(ok ? '✅ Reset concluído' : '❌ Reset falhou')
    .setDescription(result.message || (ok ? 'Operação finalizada.' : 'Erro desconhecido.'))
    .setTimestamp();

  if (result.stats && Object.keys(result.stats).length) {
    embed.addFields(
      Object.entries(result.stats).map(([name, value]) => ({
        name,
        value: String(value),
        inline: true
      }))
    );
  }

  return { embeds: [embed], components: [] };
}

module.exports = { buildConfirmPanel, buildResultEmbed, TITLES };
