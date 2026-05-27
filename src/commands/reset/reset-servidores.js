const { createResetCommand } = require('../../modules/reset/resetCommand');

module.exports = createResetCommand(
  'guilds',
  'reset-servidores',
  'Remove servidores, canais e parcerias do seu ambiente (irreversível).'
);
