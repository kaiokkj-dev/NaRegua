const { rateLimit } = require('express-rate-limit');

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde alguns minutos.' } });
const onboardingRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas alterações. Tente novamente mais tarde.' } });
const publicBookingRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas de agendamento. Aguarde alguns minutos.' } });

module.exports = { authRateLimit, onboardingRateLimit, publicBookingRateLimit };
