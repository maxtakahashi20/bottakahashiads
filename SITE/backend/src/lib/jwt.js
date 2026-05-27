const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config/env');

function signAccess(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function verifyAccess(token) {
  return jwt.verify(token, env.jwtSecret);
}

function hashRefresh(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomRefresh() {
  return crypto.randomBytes(48).toString('hex');
}

module.exports = { signAccess, verifyAccess, hashRefresh, randomRefresh };
