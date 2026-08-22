const { getSupabaseClient } = require('../config/supabase');
const { env } = require('../config/env');
const crypto = require('crypto');

const catalog = [
  { code: 'essential', name: 'Essencial', priceCents: 0, professionalLimit: 1, monthlyAppointmentLimit: 100, features: { coupons: false, prepayment: false, prioritySupport: false } },
  { code: 'pro', name: 'Pro', priceCents: 2990, professionalLimit: 5, monthlyAppointmentLimit: null, features: { coupons: true, prepayment: true, prioritySupport: false } },
  { code: 'black', name: 'Black', priceCents: 5990, professionalLimit: null, monthlyAppointmentLimit: null, features: { coupons: true, prepayment: true, prioritySupport: true } }
];

async function getShopId(db, userId) {
  const { data, error } = await db.from('barbershop_members').select('barbershop_id').eq('user_id', userId).limit(1).single();
  if (error || !data) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });
  return data.barbershop_id;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [start.toISOString(), end.toISOString()];
}

async function currentSubscription(db, shopId) {
  const { data, error } = await db.from('subscriptions').select('*').eq('barbershop_id', shopId).maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return { plan_code: 'pro', status: 'trialing', trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(), setupRequired: true };
    throw error;
  }
  return data || { plan_code: 'essential', status: 'active' };
}

function resolvePlan(subscription) {
  const trialExpired = subscription.status === 'trialing' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) <= new Date();
  const inactive = ['past_due', 'cancelled'].includes(subscription.status);
  const code = trialExpired || inactive ? 'essential' : subscription.plan_code;
  return catalog.find(plan => plan.code === code) || catalog[0];
}

async function getOverview(userId) {
  const db = getSupabaseClient();
  const shopId = await getShopId(db, userId);
  const subscription = await currentSubscription(db, shopId);
  const plan = resolvePlan(subscription);
  const [monthStart, monthEnd] = monthRange();
  const [professionals, appointments] = await Promise.all([
    db.from('professionals').select('id', { count: 'exact', head: true }).eq('barbershop_id', shopId).eq('active', true),
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('barbershop_id', shopId).gte('starts_at', monthStart).lt('starts_at', monthEnd).neq('status', 'cancelled')
  ]);
  if (professionals.error) throw professionals.error;
  if (appointments.error) throw appointments.error;
  return {
    current: {
      ...plan,
      status: subscription.status,
      trialEndsAt: subscription.trial_ends_at || null,
      periodEndsAt: subscription.current_period_end || null,
      setupRequired: Boolean(subscription.setupRequired),
      canManageBilling: subscription.provider === 'stripe' && Boolean(subscription.provider_customer_id)
    },
    usage: { professionals: professionals.count || 0, appointmentsThisMonth: appointments.count || 0 },
    plans: catalog
  };
}

async function getEntitlement(db, shopId) {
  const subscription = await currentSubscription(db, shopId);
  return resolvePlan(subscription);
}

async function assertProfessionalCapacity(db, shopId) {
  const plan = await getEntitlement(db, shopId);
  if (plan.professionalLimit == null) return;
  const { count, error } = await db.from('professionals').select('id', { count: 'exact', head: true }).eq('barbershop_id', shopId).eq('active', true);
  if (error) throw error;
  if ((count || 0) >= plan.professionalLimit) throw Object.assign(new Error(`Seu plano ${plan.name} permite até ${plan.professionalLimit} profissional. Conheça os planos para ampliar sua equipe.`), { status: 403, code: 'PLAN_LIMIT' });
}

async function assertAppointmentCapacity(db, shopId) {
  const plan = await getEntitlement(db, shopId);
  if (plan.monthlyAppointmentLimit == null) return;
  const [start, end] = monthRange();
  const { count, error } = await db.from('appointments').select('id', { count: 'exact', head: true }).eq('barbershop_id', shopId).gte('starts_at', start).lt('starts_at', end).neq('status', 'cancelled');
  if (error) throw error;
  if ((count || 0) >= plan.monthlyAppointmentLimit) throw Object.assign(new Error(`O limite de ${plan.monthlyAppointmentLimit} agendamentos mensais do plano ${plan.name} foi atingido.`), { status: 403, code: 'PLAN_LIMIT' });
}

async function assertFeature(db, shopId, feature, message) {
  const plan = await getEntitlement(db, shopId);
  if (!plan.features[feature]) throw Object.assign(new Error(message || `Este recurso não está incluído no plano ${plan.name}.`), { status: 403, code: 'PLAN_FEATURE' });
}

async function stripe(path, options = {}) {
  if (!env.stripeSecretKey) throw Object.assign(new Error('Stripe ainda não configurado.'), { status: 503 });
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${env.stripeSecretKey}`, ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(data.error?.message || '').trim().slice(0, 220);
    console.error('Stripe:', response.status, detail || 'falha sem detalhes');
    throw Object.assign(new Error(detail ? `Stripe: ${detail}` : 'Não foi possível iniciar o pagamento. Tente novamente.'), { status: 400, code: 'STRIPE_CHECKOUT' });
  }
  return data;
}

function stripeForm(fields) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
  });
  return body;
}

async function createCheckout(userId, email, planCode) {
  const plan = catalog.find(item => item.code === planCode && item.priceCents > 0);
  if (!plan) throw Object.assign(new Error('Escolha um plano pago válido.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShopId(db, userId);
  const publicBackUrl = env.appUrl || 'http://localhost:3000';
  const checkout = await stripe('/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: stripeForm({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: shopId,
      success_url: `${publicBackUrl.replace(/\/$/, '')}/assinatura?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicBackUrl.replace(/\/$/, '')}/assinatura?checkout=cancelled`,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][unit_amount]': plan.priceCents,
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][product_data][name]': `NaRégua — Plano ${plan.name}`,
      'metadata[barbershop_id]': shopId,
      'metadata[plan_code]': plan.code,
      'subscription_data[metadata][barbershop_id]': shopId,
      'subscription_data[metadata][plan_code]': plan.code,
      allow_promotion_codes: 'true'
    })
  });
  if (!checkout.id || !checkout.url) throw Object.assign(new Error('O Stripe não retornou o link de pagamento.'), { status: 502 });
  const { data: saved, error } = await db.from('subscriptions').update({ provider: 'stripe', updated_at: new Date().toISOString() }).eq('barbershop_id', shopId).select('barbershop_id').maybeSingle();
  if (error) throw Object.assign(new Error(`Assinatura criada, mas não foi possível vinculá-la: ${error.message}`), { status: 409, cause: error });
  if (!saved) {
    const created = await db.from('subscriptions').insert({ barbershop_id: shopId, plan_code: 'essential', status: 'active', provider: 'stripe' });
    if (created.error) throw Object.assign(new Error(`Assinatura criada, mas não foi possível vinculá-la: ${created.error.message}`), { status: 409, cause: created.error });
  }
  return { checkoutUrl: checkout.url };
}

async function createPortal(userId) {
  const db = getSupabaseClient();
  const shopId = await getShopId(db, userId);
  const subscription = await currentSubscription(db, shopId);
  if (subscription.provider !== 'stripe' || !subscription.provider_customer_id) {
    throw Object.assign(new Error('Esta barbearia ainda não possui uma assinatura do Stripe para gerenciar.'), { status: 409 });
  }
  const portal = await stripe('/billing_portal/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: stripeForm({
      customer: subscription.provider_customer_id,
      return_url: `${env.appUrl.replace(/\/$/, '')}/assinatura`
    })
  });
  if (!portal.url) throw Object.assign(new Error('O Stripe não retornou o acesso ao portal da assinatura.'), { status: 502 });
  return { portalUrl: portal.url };
}

async function syncCheckout(userId, sessionId) {
  if (!sessionId || !String(sessionId).startsWith('cs_')) throw Object.assign(new Error('Sessão de pagamento inválida.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShopId(db, userId);
  const remote = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`);
  const referenceShopId = remote.metadata?.barbershop_id || remote.client_reference_id;
  const planCode = remote.metadata?.plan_code;
  const plan = catalog.find(item => item.code === planCode && item.priceCents > 0);
  if (referenceShopId !== shopId || !plan) throw Object.assign(new Error('Esta assinatura não pertence à sua barbearia.'), { status: 403 });
  if (remote.payment_status !== 'paid' || !remote.subscription) return { active: false, status: remote.payment_status, plan: null };
  await applyStripeSubscription(db, remote.subscription, shopId, plan);
  return { active: true, status: remote.subscription.status, plan: plan.code };
}

function stripeDate(seconds) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function applyStripeSubscription(db, remote, shopId, plan) {
  const active = ['active', 'trialing'].includes(remote.status);
  const cancelled = ['canceled', 'incomplete_expired'].includes(remote.status);
  const periodStart = remote.current_period_start || remote.items?.data?.[0]?.current_period_start;
  const periodEnd = remote.current_period_end || remote.items?.data?.[0]?.current_period_end;
  const updates = {
    provider: 'stripe',
    provider_customer_id: typeof remote.customer === 'string' ? remote.customer : remote.customer?.id || null,
    provider_subscription_id: remote.id,
    plan_code: active ? plan.code : 'essential',
    status: active ? (remote.status === 'trialing' ? 'trialing' : 'active') : cancelled ? 'cancelled' : 'past_due',
    trial_ends_at: stripeDate(remote.trial_end),
    current_period_start: stripeDate(periodStart),
    current_period_end: stripeDate(periodEnd),
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from('subscriptions').update(updates).eq('barbershop_id', shopId);
  if (error) throw error;
}

function verifyStripeSignature(payload, signature) {
  if (!env.stripeWebhookSecret) throw Object.assign(new Error('Webhook do Stripe ainda não configurado.'), { status: 503 });
  if (!payload || !signature) return false;
  const parts = String(signature).split(',').reduce((result, part) => {
    const [key, value] = part.split('=');
    if (key && value) (result[key] ||= []).push(value);
    return result;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const digest = crypto.createHmac('sha256', env.stripeWebhookSecret).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex');
  const expected = Buffer.from(digest, 'hex');
  return signatures.some(value => {
    const received = Buffer.from(value, 'hex');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  });
}

async function handleWebhook({ payload, signature }) {
  if (!verifyStripeSignature(payload, signature)) throw Object.assign(new Error('Assinatura do webhook inválida.'), { status: 401 });
  const event = JSON.parse(payload.toString('utf8'));
  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) return { ignored: true };
  const remote = event.data?.object;
  const shopId = remote?.metadata?.barbershop_id;
  const planCode = remote?.metadata?.plan_code;
  const plan = catalog.find(item => item.code === planCode && item.priceCents > 0);
  if (!shopId || !plan) return { ignored: true };
  const db = getSupabaseClient();
  const { data: shop, error } = await db.from('barbershops').select('id').eq('id', shopId).maybeSingle();
  if (error) throw error;
  if (!shop) return { ignored: true };
  await applyStripeSubscription(db, remote, shopId, plan);
  return { received: true };
}

module.exports = { getOverview, assertProfessionalCapacity, assertAppointmentCapacity, assertFeature, createCheckout, createPortal, syncCheckout, handleWebhook };
