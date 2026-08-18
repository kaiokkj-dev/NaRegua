const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const issuer = 'naregua-api';
const audience = 'naregua-web';

function signAccessToken(user) {
  if (!env.jwtSecret) throw Object.assign(new Error('Autenticação não configurada.'), { status: 503 });
  return jwt.sign({ sub: user.id, email: user.email, type: 'access' }, env.jwtSecret, { expiresIn: '8h', issuer, audience });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, { issuer, audience });
}

function cookieOptions() {
  return { httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, path: '/' };
}

module.exports = { signAccessToken, verifyAccessToken, cookieOptions };
