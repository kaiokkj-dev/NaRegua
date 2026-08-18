function list(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  appUrl: process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  allowedOrigins: list(process.env.ALLOWED_ORIGINS || process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`),
  jwtSecret: process.env.JWT_SECRET || '',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'naregua_session',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${Number(process.env.PORT) || 3000}/api/auth/google/callback`
};

env.isProduction = env.nodeEnv === 'production';
env.authConfigured = Boolean(env.jwtSecret && env.supabaseUrl && env.supabaseServiceRoleKey && env.googleClientId && env.googleClientSecret);

if (env.isProduction) {
  const missing = [];
  if (env.jwtSecret.length < 32) missing.push('JWT_SECRET (mínimo de 32 caracteres)');
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.googleClientId) missing.push('GOOGLE_CLIENT_ID');
  if (!env.googleClientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (missing.length) throw new Error(`Configuração de produção incompleta: ${missing.join(', ')}`);
}

module.exports = { env };
