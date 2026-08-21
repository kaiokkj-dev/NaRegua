const crypto = require('crypto');
const { env } = require('../config/env');
const { getSupabaseClient } = require('../config/supabase');

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 13);
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

function hash(value) {
  return crypto.createHmac('sha256', env.jwtSecret).update(String(value)).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function findShop(db, slug) {
  const { data, error } = await db.from('barbershops').select('id').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });
  return data;
}

async function sendWhatsAppCode(phone, code) {
  const response = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(env.whatsappPhoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.whatsappAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: `55${phone}`,
      type: 'template',
      template: {
        name: env.whatsappOtpTemplate,
        language: { code: env.whatsappLanguage },
        components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }]
      }
    })
  });
  if (!response.ok) {
    const details = await response.text();
    console.error('Falha ao enviar OTP pelo WhatsApp:', response.status, details.slice(0, 500));
    throw Object.assign(new Error('Não foi possível enviar o código pelo WhatsApp.'), { status: 502 });
  }
}

async function requestCode(slug, rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 10 || phone.length > 11) throw Object.assign(new Error('Informe um WhatsApp válido com DDD.'), { status: 400 });
  const db = getSupabaseClient();
  const shop = await findShop(db, slug);
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await db.from('booking_phone_verifications').insert({ barbershop_id: shop.id, phone, code_hash: hash(`${shop.id}:${phone}:${code}`), expires_at: expiresAt });
  if (error) throw error;

  if (env.whatsappOtpEnabled && env.whatsappAccessToken && env.whatsappPhoneNumberId) await sendWhatsAppCode(phone, code);
  return { sent: true, expiresInSeconds: 300, ...(env.isProduction ? {} : { developmentCode: code }) };
}

async function confirmCode(slug, rawPhone, rawCode) {
  const phone = normalizePhone(rawPhone);
  const code = String(rawCode || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) throw Object.assign(new Error('Digite o código de 6 números.'), { status: 400 });
  const db = getSupabaseClient();
  const shop = await findShop(db, slug);
  const { data, error } = await db.from('booking_phone_verifications').select('id,code_hash,attempts,expires_at').eq('barbershop_id', shop.id).eq('phone', phone).is('verified_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at) <= new Date()) throw Object.assign(new Error('O código expirou. Solicite outro.'), { status: 400 });
  if (data.attempts >= 5) throw Object.assign(new Error('Muitas tentativas. Solicite outro código.'), { status: 429 });
  if (!safeEqual(data.code_hash, hash(`${shop.id}:${phone}:${code}`))) {
    await db.from('booking_phone_verifications').update({ attempts: data.attempts + 1 }).eq('id', data.id);
    throw Object.assign(new Error('Código incorreto.'), { status: 400 });
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const verifiedAt = new Date().toISOString();
  const updated = await db.from('booking_phone_verifications').update({ verified_at: verifiedAt, token_hash: hash(token) }).eq('id', data.id);
  if (updated.error) throw updated.error;
  return { verificationToken: token };
}

async function assertVerification(db, shopId, rawPhone, token) {
  if (!env.whatsappOtpEnabled) return null;
  const phone = normalizePhone(rawPhone);
  if (!token) throw Object.assign(new Error('Confirme seu WhatsApp antes de agendar.'), { status: 401 });
  const { data, error } = await db.from('booking_phone_verifications').select('id,expires_at').eq('barbershop_id', shopId).eq('phone', phone).eq('token_hash', hash(token)).is('used_at', null).not('verified_at', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at) <= new Date()) throw Object.assign(new Error('A confirmação do WhatsApp expirou.'), { status: 401 });
  return data.id;
}

async function markVerificationUsed(db, verificationId) {
  if (!verificationId) return;
  const { error } = await db.from('booking_phone_verifications').update({ used_at: new Date().toISOString() }).eq('id', verificationId).is('used_at', null);
  if (error) throw error;
}

module.exports = { requestCode, confirmCode, assertVerification, markVerificationUsed };
