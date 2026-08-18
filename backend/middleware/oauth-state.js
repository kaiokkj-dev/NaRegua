const crypto = require('crypto');
const { env } = require('../config/env');

const stateCookie = 'naregua_oauth_state';

function signature(value) {
  return crypto.createHmac('sha256', env.jwtSecret).update(value).digest('base64url');
}

function createOAuthState(request, response, next) {
  const nonce = crypto.randomBytes(32).toString('base64url');
  response.cookie(stateCookie, `${nonce}.${signature(nonce)}`, { httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/auth/google' });
  request.oauthState = nonce;
  next();
}

function verifyOAuthState(request, response, next) {
  const value = request.cookies?.[stateCookie] || '';
  const [nonce, receivedSignature] = value.split('.');
  const queryState = String(request.query.state || '');
  response.clearCookie(stateCookie, { path: '/api/auth/google' });
  if (!nonce || !receivedSignature || queryState !== nonce) return response.redirect('/?auth_error=invalid_state');
  const expected = signature(nonce);
  if (receivedSignature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expected))) return response.redirect('/?auth_error=invalid_state');
  next();
}

module.exports = { createOAuthState, verifyOAuthState };
