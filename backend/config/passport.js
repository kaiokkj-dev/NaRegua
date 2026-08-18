const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { env } = require('./env');
const { findOrCreateGoogleUser } = require('../services/auth.service');

let configured = false;
if (env.authConfigured) {
  passport.use(new GoogleStrategy({ clientID: env.googleClientId, clientSecret: env.googleClientSecret, callbackURL: env.googleCallbackUrl }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.trim().toLowerCase();
      if (!email || profile.emails?.[0]?.verified === false) return done(null, false, { message: 'Conta Google sem e-mail verificado.' });
      const user = await findOrCreateGoogleUser({ googleSub: profile.id, email, name: profile.displayName || email.split('@')[0], avatarUrl: profile.photos?.[0]?.value || null });
      return done(null, user);
    } catch (error) { return done(error); }
  }));
  configured = true;
}

module.exports = { passport, isGoogleAuthConfigured: () => configured };
