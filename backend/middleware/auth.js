const { env } = require('../config/env');
const { verifyAccessToken } = require('../services/token.service');

function readToken(request) {
  const cookieToken = request.cookies?.[env.authCookieName];
  if (cookieToken) return cookieToken;
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  return /^Bearer$/i.test(scheme) && token ? token : null;
}

function authenticate(request, response, next) {
  try {
    const token = readToken(request);
    if (!token) return response.status(401).json({ error: 'Autenticação necessária.' });
    request.user = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return response.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

function requirePageAuth(request, response, next) {
  try {
    const token = readToken(request);
    if (!token) return response.redirect('/?auth=required');
    request.user = verifyAccessToken(token);
    return next();
  } catch (_error) {
    response.clearCookie(env.authCookieName, { path: '/' });
    return response.redirect('/?auth=expired');
  }
}

module.exports = { authenticate, requirePageAuth };
