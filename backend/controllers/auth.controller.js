const { env } = require('../config/env');
const { signAccessToken, cookieOptions } = require('../services/token.service');
const { getUserContext, completeOnboarding } = require('../services/auth.service');

function googleCallback(request, response) {
  const token = signAccessToken(request.user);
  response.cookie(env.authCookieName, token, cookieOptions());
  response.set('Cache-Control', 'no-store');
  return response.redirect('/dashboard');
}

async function me(request, response, next) {
  try {
    response.set('Cache-Control', 'no-store');
    return response.json(await getUserContext(request.user.sub));
  } catch (error) { return next(error); }
}

async function onboarding(request, response, next) {
  try {
    return response.json(await completeOnboarding(request.user.sub, request.body));
  } catch (error) { return next(error); }
}

function logout(_request, response) {
  response.clearCookie(env.authCookieName, { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: '/' });
  response.set('Cache-Control', 'no-store');
  return response.status(204).end();
}

module.exports = { googleCallback, me, onboarding, logout };
