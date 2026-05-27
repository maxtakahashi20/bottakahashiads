const { createResetCommand } = require('../../modules/reset/resetCommand');

module.exports = createResetCommand(
  'all',
  'reset-geral',
  'Zera completamente o ambiente: tokens, servidores, configs e analytics.'
);
