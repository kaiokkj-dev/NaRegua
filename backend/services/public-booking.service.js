const { getSupabaseClient } = require('../config/supabase');
const { assertNoAppointmentConflict, translateAppointmentConflict } = require('./appointment-conflict.service');
const { getBusinessHoursForShop, assertWithinBusinessHours } = require('./business-hours.service');
const { env } = require('../config/env');
const { assertVerification, markVerificationUsed } = require('./booking-verification.service');
const { sendBookingCreated } = require('./email-notification.service');

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function assertClientData(name, phone) {
  if (name.length < 2 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name) || /\d/.test(name)) throw Object.assign(new Error('Informe um nome válido, sem números.'), { status: 400 });
  if (phone.length < 10 || phone.length > 13) throw Object.assign(new Error('Informe um WhatsApp válido com DDD.'), { status: 400 });
}

async function getShop(slug) {
  const db = getSupabaseClient();
  const { data: shop, error } = await db.from('barbershops').select('id,name,slug,phone,created_by,prepayment_enabled,prepayment_percent,pix_key,pix_holder_name').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!shop) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });
  const [servicesResult, professionalsResult, hoursResult] = await Promise.all([
    db.from('services').select('id,name,duration_minutes,price_cents').eq('barbershop_id', shop.id).eq('active', true).order('name'),
    db.from('professionals').select('id,name').eq('barbershop_id', shop.id).eq('active', true).order('name'),
    getBusinessHoursForShop(db, shop.id).then(data => ({ data })).catch(error => ({ error }))
  ]);
  if (servicesResult.error) throw servicesResult.error;
  if (professionalsResult.error) throw professionalsResult.error;
  if (hoursResult.error) throw hoursResult.error;
  return {
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      phone: shop.phone,
      phoneVerificationRequired: env.whatsappOtpEnabled,
      prepayment: {
        enabled: Boolean(shop.prepayment_enabled && shop.pix_key),
        percent: shop.prepayment_percent || 50,
        pixKey: shop.pix_key || '',
        pixHolderName: shop.pix_holder_name || ''
      }
    },
    services: servicesResult.data || [],
    businessHours: hoursResult.data || [],
    professionals: professionalsResult.data || []
  };
}

async function validateCouponForShop(db, shopId, code, priceCents) {
  if (!code) return { coupon: null, discountCents: 0, finalPriceCents: priceCents };
  const normalized = String(code).trim().toUpperCase().slice(0, 24);
  const { data: coupon, error } = await db.from('coupons').select('id,code,discount_type,discount_value,min_order_cents,max_uses,uses_count,starts_at,ends_at,active').eq('barbershop_id', shopId).eq('code', normalized).maybeSingle();
  if (error) throw error;
  const now = new Date();
  if (!coupon || !coupon.active || (coupon.starts_at && new Date(coupon.starts_at) > now) || (coupon.ends_at && new Date(coupon.ends_at) < now) || (coupon.max_uses && coupon.uses_count >= coupon.max_uses)) throw Object.assign(new Error('Cupom inválido ou expirado.'), { status: 400 });
  if (priceCents < coupon.min_order_cents) throw Object.assign(new Error('Este serviço não atinge o valor mínimo do cupom.'), { status: 400 });
  const rawDiscount = coupon.discount_type === 'percent' ? Math.round(priceCents * Math.min(100, coupon.discount_value) / 100) : coupon.discount_value;
  const discountCents = Math.min(priceCents, rawDiscount);
  return { coupon, discountCents, finalPriceCents: priceCents - discountCents };
}

async function validateCoupon(slug, input) {
  const db = getSupabaseClient();
  const { data: shop } = await db.from('barbershops').select('id').eq('slug', slug).maybeSingle();
  if (!shop) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });
  const { data: service } = await db.from('services').select('price_cents').eq('id', input.serviceId).eq('barbershop_id', shop.id).eq('active', true).maybeSingle();
  if (!service) throw Object.assign(new Error('Serviço indisponível.'), { status: 400 });
  const result = await validateCouponForShop(db, shop.id, input.code, service.price_cents);
  return { code: result.coupon.code, discountCents: result.discountCents, finalPriceCents: result.finalPriceCents };
}

async function createBooking(slug, input) {
  const required = ['name', 'phone', 'email', 'serviceId', 'startsAt'];
  if (required.some(key => typeof input[key] !== 'string' || !input[key].trim())) throw Object.assign(new Error('Preencha os dados obrigatórios.'), { status: 400 });
  const clientName = normalizeName(input.name);
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  assertClientData(clientName, phone);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Informe um e-mail válido.'), { status: 400 });
  const db = getSupabaseClient();
  const { data: shop, error: shopError } = await db.from('barbershops').select('id,name,created_by,prepayment_enabled,prepayment_percent,pix_key,pix_holder_name').eq('slug', slug).maybeSingle();
  if (shopError) throw shopError;
  if (!shop) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });
  const verificationId = await assertVerification(db, shop.id, phone, input.verificationToken);
  const startsAt = new Date(input.startsAt);
  const now = new Date(); const limit = new Date(); limit.setDate(limit.getDate() + 90);
  if (Number.isNaN(startsAt.getTime()) || startsAt <= now || startsAt > limit) throw Object.assign(new Error('Escolha um horário futuro válido.'), { status: 400 });
  const [serviceResult, professionalResult] = await Promise.all([
    db.from('services').select('id,name,duration_minutes,price_cents').eq('id', input.serviceId).eq('barbershop_id', shop.id).eq('active', true).maybeSingle(),
    input.professionalId ? db.from('professionals').select('id,name').eq('id', input.professionalId).eq('barbershop_id', shop.id).eq('active', true).maybeSingle() : Promise.resolve({ data: null })
  ]);
  if (serviceResult.error || !serviceResult.data) throw Object.assign(new Error('Serviço indisponível.'), { status: 400 });
  if (professionalResult.error || (input.professionalId && !professionalResult.data)) throw Object.assign(new Error('Profissional indisponível.'), { status: 400 });
  const professionalId = professionalResult.data?.id || null;
  await assertWithinBusinessHours(db, { barbershopId: shop.id, startsAt, durationMinutes: serviceResult.data.duration_minutes });
  await assertNoAppointmentConflict(db, { barbershopId: shop.id, professionalId, startsAt, durationMinutes: serviceResult.data.duration_minutes });
  let { data: client, error: clientError } = await db.from('clients').select('id').eq('barbershop_id', shop.id).eq('phone', phone).maybeSingle();
  if (clientError) throw clientError;
  if (!client) {
    const created = await db.from('clients').insert({ barbershop_id: shop.id, name: clientName, phone, email }).select('id').single();
    if (created.error) throw created.error; client = created.data;
  } else {
    const updatedClient = await db.from('clients').update({ name: clientName, email }).eq('id', client.id);
    if (updatedClient.error) throw updatedClient.error;
  }
  const service = serviceResult.data;
  const couponResult = await validateCouponForShop(db, shop.id, input.couponCode, service.price_cents);
  const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 1000) : null;
  const prepaymentEnabled = Boolean(shop.prepayment_enabled && shop.pix_key);
  const prepaymentCents = prepaymentEnabled ? Math.max(1, Math.round(couponResult.finalPriceCents * (shop.prepayment_percent || 50) / 100)) : 0;
  const status = prepaymentEnabled ? 'pending' : 'confirmed';
  const paymentStatus = prepaymentEnabled ? 'awaiting_manual_confirmation' : 'not_required';
  const { data, error } = await db.from('appointments').insert({ barbershop_id: shop.id, client_id: client.id, service_id: service.id, professional_id: professionalId, starts_at: startsAt.toISOString(), duration_minutes: service.duration_minutes, original_price_cents: service.price_cents, discount_cents: couponResult.discountCents, price_cents: couponResult.finalPriceCents, coupon_id: couponResult.coupon?.id || null, notes, status, prepayment_required: prepaymentEnabled, prepayment_cents: prepaymentCents, payment_status: paymentStatus, created_by: shop.created_by }).select('id,starts_at,status,prepayment_cents,payment_status').single();
  if (error) throw translateAppointmentConflict(error);
  await markVerificationUsed(db, verificationId);
  if (couponResult.coupon) await db.from('coupons').update({ uses_count: couponResult.coupon.uses_count + 1 }).eq('id', couponResult.coupon.id);
  const { data: owner } = await db.from('users').select('email').eq('id', shop.created_by).maybeSingle();
  await sendBookingCreated({ clientName, clientEmail: email, phone, ownerEmail: owner?.email, shopName: shop.name, serviceName: service.name, professionalName: professionalResult.data?.name, startsAt: startsAt.toISOString(), priceCents: couponResult.finalPriceCents, pending: status === 'pending' });
  return data;
}

module.exports = { getShop, createBooking, validateCoupon };
