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
    current: { ...plan, status: subscription.status, trialEndsAt: subscription.trial_ends_at || null, periodEndsAt: subscription.current_period_end || null, setupRequired: Boolean(subscription.setupRequired) },
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

async function mercadoPago(path, options = {}) {
  if (!env.mercadoPagoAccessToken) throw Object.assign(new Error('Pagamento ainda não configurado.'), { status: 503 });
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${env.mercadoPagoAccessToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(12000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(data.message || data.error || data.cause?.[0]?.description || '').trim().slice(0, 180);
    console.error('Mercado Pago:', response.status, detail || 'falha sem detalhes');
    throw Object.assign(new Error(detail ? `Mercado Pago: ${detail}` : 'Não foi possível iniciar o pagamento. Tente novamente.'), { status: 400, code: 'MERCADO_PAGO_CHECKOUT' });
  }
  return data;
}

async function createCheckout(userId, email, planCode) {
  const plan = catalog.find(item => item.code === planCode && item.priceCents > 0);
  if (!plan) throw Object.assign(new Error('Escolha um plano pago válido.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShopId(db, userId);
  const publicBackUrl = env.mercadoPagoBackUrl || (/^https:\/\//i.test(env.appUrl) ? env.appUrl : 'https://na-regua-liart.vercel.app');
  // Assinaturas de teste exigem que vendedor e pagador sejam usuários de teste.
  // Em produção, sem a variável abaixo, continua sendo usado o e-mail autenticado.
  const payerEmail = env.mercadoPagoTestPayerEmail || email;
  const checkout = await mercadoPago('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: `NaRégua — Plano ${plan.name}`,
      external_reference: `${shopId}:${plan.code}`,
      payer_email: payerEmail,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.priceCents / 100, currency_id: 'BRL' },
      back_url: `${publicBackUrl.replace(/\/$/, '')}/assinatura?checkout=return`,
      notification_url: `${publicBackUrl.replace(/\/$/, '')}/api/subscription/webhook`,
      status: 'pending'
    })
  });
  if (!checkout.id || !checkout.init_point) throw Object.assign(new Error('O Mercado Pago não retornou o link de pagamento.'), { status: 502 });
  const { data: saved, error } = await db.from('subscriptions').update({ provider: 'mercado_pago', provider_subscription_id: checkout.id, updated_at: new Date().toISOString() }).eq('barbershop_id', shopId).select('barbershop_id').maybeSingle();
  if (error) throw Object.assign(new Error(`Assinatura criada, mas não foi possível vinculá-la: ${error.message}`), { status: 409, cause: error });
  if (!saved) {
    const created = await db.from('subscriptions').insert({ barbershop_id: shopId, plan_code: 'essential', status: 'active', provider: 'mercado_pago', provider_subscription_id: checkout.id });
    if (created.error) throw Object.assign(new Error(`Assinatura criada, mas não foi possível vinculá-la: ${created.error.message}`), { status: 409, cause: created.error });
  }
  return { checkoutUrl: checkout.init_point };
}

async function syncCheckout(userId, preapprovalId) {
  if (!preapprovalId) throw Object.assign(new Error('Assinatura não informada.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShopId(db, userId);
  const remote = await mercadoPago(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  const [referenceShopId, planCode] = String(remote.external_reference || '').split(':');
  const plan = catalog.find(item => item.code === planCode && item.priceCents > 0);
  if (referenceShopId !== shopId || !plan) throw Object.assign(new Error('Esta assinatura não pertence à sua barbearia.'), { status: 403 });
  await applyRemoteSubscription(db, remote, shopId, plan);
  return { active: remote.status === 'authorized', status: remote.status, plan: remote.status === 'authorized' ? plan.code : null };
}

async function applyRemoteSubscription(db, remote, shopId, plan) {
  const updates = { provider: 'mercado_pago', provider_subscription_id: remote.id, updated_at: new Date().toISOString() };
  if (remote.status === 'authorized') Object.assign(updates, { plan_code: plan.code, status: 'active', trial_ends_at: null, current_period_start: new Date().toISOString(), current_period_end: remote.next_payment_date || null });
  if (remote.status === 'cancelled') Object.assign(updates, { plan_code: 'essential', status: 'cancelled', trial_ends_at: null, current_period_end: new Date().toISOString() });
  if (remote.status === 'paused') Object.assign(updates, { plan_code: 'essential', status: 'past_due', trial_ends_at: null });
  const { error } = await db.from('subscriptions').update(updates).eq('barbershop_id', shopId);
  if (error) throw error;
}

function verifyWebhookSignature({ signature, requestId, dataId }) {
  if (!env.mercadoPagoWebhookSecret) return true;
  const parts = Object.fromEntries(String(signature || '').split(',').map(item => item.split('=')));
  if (!parts.ts || !parts.v1 || !requestId || !dataId) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const digest = crypto.createHmac('sha256', env.mercadoPagoWebhookSecret).update(manifest).digest('hex');
  const received = Buffer.from(parts.v1, 'utf8');
  const expected = Buffer.from(digest, 'utf8');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

async function handleWebhook({ type, dataId, signature, requestId }) {
  if (!['subscription_preapproval', 'preapproval'].includes(String(type || '')) || !dataId) return { ignored: true };
  if (!verifyWebhookSignature({ signature, requestId, dataId })) throw Object.assign(new Error('Assinatura do webhook inválida.'), { status: 401 });
  const remote = await mercadoPago(`/preapproval/${encodeURIComponent(dataId)}`);
  const [shopId, planCode] = String(remote.external_reference || '').split(':');
  const plan = catalog.find(item => item.code === planCode && item.priceCents > 0);
  if (!shopId || !plan) return { ignored: true };
  const db = getSupabaseClient();
  const { data: shop, error } = await db.from('barbershops').select('id').eq('id', shopId).maybeSingle();
  if (error) throw error;
  if (!shop) return { ignored: true };
  await applyRemoteSubscription(db, remote, shopId, plan);
  return { received: true };
}

module.exports = { getOverview, assertProfessionalCapacity, assertAppointmentCapacity, assertFeature, createCheckout, syncCheckout, handleWebhook };
