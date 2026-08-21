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
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${Number(process.env.PORT) || 3000}/api/auth/google/callback`,
  whatsappOtpEnabled: String(process.env.WHATSAPP_OTP_ENABLED || '').toLowerCase() === 'true',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappOtpTemplate: process.env.WHATSAPP_OTP_TEMPLATE || 'codigo_verificacao',
  whatsappLanguage: process.env.WHATSAPP_LANGUAGE || 'pt_BR',
  emailNotificationsEnabled: String(process.env.EMAIL_NOTIFICATIONS_ENABLED || '').toLowerCase() === 'true',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'NaRégua <onboarding@resend.dev>'
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
  if (env.whatsappOtpEnabled && !env.whatsappAccessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (env.whatsappOtpEnabled && !env.whatsappPhoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (env.emailNotificationsEnabled && !env.resendApiKey) missing.push('RESEND_API_KEY');
  if (missing.length) throw new Error(`Configuração de produção incompleta: ${missing.join(', ')}`);
}

module.exports = { env };
