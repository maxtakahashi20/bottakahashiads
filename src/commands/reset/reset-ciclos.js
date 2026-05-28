const { createResetCommand } = require('../../modules/reset/resetCommand');

module.exports = createResetCommand(
  'cycles',
  'reset-ciclos',
  'Zera contador de ciclos, histórico de divulgações e timers de envio (irreversível).'
);
