const pino = require('pino');

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: null
  },
  process.env.NODE_ENV === 'production'
    ? undefined
    : require('pino-pretty')({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      })
);

module.exports = { logger };

