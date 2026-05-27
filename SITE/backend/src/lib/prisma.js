const path = require('path');
const fs = require('fs');

/**
 * Usa o Prisma Client gerado na raiz do bot (npm run prisma:generate).
 * Evita client vazio em SITE/node_modules do workspace.
 */
function loadPrismaClient() {
  const rootClient = path.resolve(__dirname, '../../../../node_modules/@prisma/client');
  const siteClient = path.resolve(__dirname, '../../../node_modules/@prisma/client');

  for (const dir of [rootClient, siteClient]) {
    try {
      if (fs.existsSync(path.join(dir, 'index.js')) || fs.existsSync(path.join(dir, 'default.js'))) {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        return require(dir);
      }
    } catch {
      /* try next */
    }
  }

  return require('@prisma/client');
}

const { PrismaClient } = loadPrismaClient();
const prisma = new PrismaClient();

module.exports = { prisma };
