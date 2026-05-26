const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

// Singleton por processo (evita múltiplos clients no sharding)
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__takahashiPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : [
            { level: 'warn', emit: 'event' },
            { level: 'error', emit: 'event' }
          ]
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__takahashiPrisma = prisma;
}

prisma.$on('warn', (e) => logger.warn({ prisma: true, ...e }, e.message));
prisma.$on('error', (e) => logger.error({ prisma: true, ...e }, e.message));

module.exports = { prisma };

