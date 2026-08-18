const router = require('express').Router();
const { passport, isGoogleAuthConfigured } = require('../config/passport');
const { createOAuthState, verifyOAuthState } = require('../middleware/oauth-state');
const { authenticate } = require('../middleware/auth');
const { authRateLimit, onboardingRateLimit } = require('../middleware/rate-limit');
const controller = require('../controllers/auth.controller');

function requireConfiguration(_request, response, next) {
  if (!isGoogleAuthConfigured()) return response.redirect('/?auth_error=not_configured');
  return next();
}

router.get('/status', (_request, response) => response.json({ google: isGoogleAuthConfigured() }));
router.get('/google', authRateLimit, requireConfiguration, createOAuthState, (request, response, next) => passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: request.oauthState, prompt: 'select_account' })(request, response, next));
router.get('/google/callback', authRateLimit, requireConfiguration, verifyOAuthState, passport.authenticate('google', { session: false, failureRedirect: '/?auth_error=google' }), controller.googleCallback);
router.get('/me', authenticate, controller.me);
router.post('/onboarding', onboardingRateLimit, authenticate, controller.onboarding);
router.post('/logout', authenticate, controller.logout);

module.exports = router;
