const PREFIX = 'reset';

const BTN = {
  confirmGuilds: `${PREFIX}:confirm:guilds`,
  cancelGuilds: `${PREFIX}:cancel:guilds`,
  confirmToken: `${PREFIX}:confirm:token`,
  cancelToken: `${PREFIX}:cancel:token`,
  confirmAll: `${PREFIX}:confirm:all`,
  cancelAll: `${PREFIX}:cancel:all`
};

const RESET_TYPES = {
  guilds: 'guilds',
  token: 'token',
  all: 'all'
};

function isResetButton(id) {
  return typeof id === 'string' && id.startsWith(`${PREFIX}:`);
}

module.exports = { PREFIX, BTN, RESET_TYPES, isResetButton };
