const crypto = require('crypto');
const { LICENSE_PREFIX } = require('../../config/licensing');

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Gera sufixo aleatório criptograficamente seguro (7–12 caracteres).
 */
function randomSuffix(minLen = 7, maxLen = 12) {
  const len = minLen + (crypto.randomInt(0, maxLen - minLen + 1));
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }
  return out;
}

/**
 * Código no formato takahashi-store-XXXXXXX (fácil de copiar).
 */
function generateLicenseCode() {
  return `${LICENSE_PREFIX}${randomSuffix()}`;
}

module.exports = { generateLicenseCode, randomSuffix };
