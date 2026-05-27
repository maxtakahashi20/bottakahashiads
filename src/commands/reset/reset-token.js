const { createResetCommand } = require('../../modules/reset/resetCommand');

module.exports = createResetCommand(
  'token',
  'reset-token',
  'Remove tokens de usuário e limpa autenticação de envio (irreversível).'
);
