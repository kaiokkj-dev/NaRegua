const { getSupabaseClient } = require('../config/supabase');
const { assertNoAppointmentConflict, translateAppointmentConflict } = require('./appointment-conflict.service');
const shopCache = new Map();
const SHOP_CACHE_TTL = 5 * 60 * 1000;

async function getShop(userId) {
  const cached = shopCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.shopId;
  const db = getSupabaseClient();
  const { data, error } = await db.from('barbershop_members').select('barbershop_id').eq('user_id', userId).limit(1).single();
  if (error || !data) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });
  shopCache.set(userId, { shopId: data.barbershop_id, expiresAt: Date.now() + SHOP_CACHE_TTL });
  return data.barbershop_id;
}

function dayRange(date) {
  const base = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00-03:00`) : new Date();
  if (!date) base.setHours(0, 0, 0, 0);
  const end = new Date(base); end.setDate(end.getDate() + 1);
  return [base.toISOString(), end.toISOString()];
}

async function dashboard(userId, date) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const [start, end] = dayRange(date);
  const { data, error } = await db.from('appointments')
    .select('id,starts_at,duration_minutes,price_cents,status,clients(name,phone),services(name),professionals(name)')
    .eq('barbershop_id', shopId).gte('starts_at', start).lt('starts_at', end).order('starts_at');
  if (error) throw error;
  const appointments = data || [];
  const active = appointments.filter(item => item.status !== 'cancelled');
  return {
    appointments,
    stats: {
      total: active.length,
      pending: active.filter(item => item.status === 'pending').length,
      confirmed: active.filter(item => item.status === 'confirmed').length,
      cancelled: appointments.filter(item => item.status === 'cancelled').length,
      revenueCents: active.reduce((sum, item) => sum + item.price_cents, 0),
      clients: new Set(active.map(item => item.clients?.phone).filter(Boolean)).size
    }
  };
}

async function createAppointment(userId, input) {
  const required = ['clientName', 'phone', 'serviceName', 'startsAt'];
  if (required.some(key => typeof input[key] !== 'string' || !input[key].trim())) throw Object.assign(new Error('Preencha os dados obrigatórios.'), { status: 400 });
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw Object.assign(new Error('Data inválida.'), { status: 400 });
  const duration = Math.min(480, Math.max(5, Number(input.duration) || 30));
  const priceCents = Math.max(0, Math.round((Number(input.price) || 0) * 100));
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const phone = input.phone.trim().slice(0, 30);

  const serviceName = input.serviceName.trim().slice(0, 100);
  const [clientLookup, serviceLookup] = await Promise.all([
    db.from('clients').select('id').eq('barbershop_id', shopId).eq('phone', phone).maybeSingle(),
    db.from('services').select('id').eq('barbershop_id', shopId).eq('name', serviceName).maybeSingle()
  ]);
  if (clientLookup.error) throw clientLookup.error;
  if (serviceLookup.error) throw serviceLookup.error;
  let client = clientLookup.data;
  let service = serviceLookup.data;
  const creations = [];
  if (!client) {
    creations.push(db.from('clients').insert({ barbershop_id: shopId, name: input.clientName.trim().slice(0, 100), phone }).select('id').single().then(result => {
      if (result.error) throw result.error; client = result.data;
    }));
  }
  if (!service) {
    creations.push(db.from('services').insert({ barbershop_id: shopId, name: serviceName, duration_minutes: duration, price_cents: priceCents }).select('id').single().then(result => {
      if (result.error) throw result.error; service = result.data;
    }));
  }
  await Promise.all(creations);
  let professionalId = null;
  if (typeof input.professionalId === 'string' && input.professionalId) {
    const { data: professional, error: professionalError } = await db.from('professionals').select('id').eq('id', input.professionalId).eq('barbershop_id', shopId).eq('active', true).maybeSingle();
    if (professionalError) throw professionalError;
    if (!professional) throw Object.assign(new Error('Profissional inválido ou indisponível.'), { status: 400 });
    professionalId = professional.id;
  }
  if (startsAt <= new Date()) throw Object.assign(new Error('Escolha um horário futuro.'), { status: 400 });
  await assertNoAppointmentConflict(db, { barbershopId: shopId, professionalId, startsAt, durationMinutes: duration });
  const { data, error } = await db.from('appointments').insert({ barbershop_id: shopId, client_id: client.id, service_id: service.id, professional_id: professionalId, starts_at: startsAt.toISOString(), duration_minutes: duration, price_cents: priceCents, status: 'confirmed', created_by: userId }).select('id').single();
  if (error) throw translateAppointmentConflict(error);
  return data;
}

async function updateAppointmentStatus(userId, appointmentId, status) {
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', appointmentId).eq('barbershop_id', shopId).select('id,status').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Agendamento não encontrado.'), { status: 404 });
  return data;
}

async function listClients(userId, search = '') {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  let query = db.from('clients').select('id,name,phone,created_at,appointments(id,starts_at,status)').eq('barbershop_id', shopId).order('name');
  const safeSearch = String(search).trim().replace(/[%_,()]/g, '').slice(0, 60);
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(client => ({ ...client, appointments: client.appointments || [] }));
}

async function createClient(userId, input) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || typeof input.phone !== 'string' || !input.phone.trim()) throw Object.assign(new Error('Informe nome e telefone.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('clients').insert({ barbershop_id: shopId, name: input.name.trim().slice(0, 100), phone: input.phone.trim().slice(0, 30) }).select('id,name,phone,created_at').single();
  if (error?.code === '23505') throw Object.assign(new Error('Este telefone já está cadastrado.'), { status: 409 });
  if (error) throw error;
  return data;
}

async function listServices(userId) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('services').select('id,name,duration_minutes,price_cents,active,created_at').eq('barbershop_id', shopId).order('active', { ascending: false }).order('name');
  if (error) throw error;
  return data || [];
}

function servicePayload(input) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2) throw Object.assign(new Error('Informe o nome do serviço.'), { status: 400 });
  const duration = Number(input.duration);
  const price = Number(input.price);
  if (!Number.isFinite(duration) || duration < 5 || duration > 480 || !Number.isFinite(price) || price < 0) throw Object.assign(new Error('Duração ou preço inválido.'), { status: 400 });
  return { name: input.name.trim().slice(0, 100), duration_minutes: Math.round(duration), price_cents: Math.round(price * 100) };
}

async function createService(userId, input) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('services').insert({ barbershop_id: shopId, ...servicePayload(input) }).select('id,name,duration_minutes,price_cents,active').single();
  if (error?.code === '23505') throw Object.assign(new Error('Já existe um serviço com este nome.'), { status: 409 });
  if (error) throw error;
  return data;
}

async function updateService(userId, serviceId, input) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const updates = typeof input.active === 'boolean' && !input.name ? { active: input.active } : { ...servicePayload(input), ...(typeof input.active === 'boolean' ? { active: input.active } : {}) };
  const { data, error } = await db.from('services').update(updates).eq('id', serviceId).eq('barbershop_id', shopId).select('id,name,duration_minutes,price_cents,active').maybeSingle();
  if (error?.code === '23505') throw Object.assign(new Error('Já existe um serviço com este nome.'), { status: 409 });
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Serviço não encontrado.'), { status: 404 });
  return data;
}

async function listProfessionals(userId) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('professionals').select('id,name,active,created_at,appointments(id,starts_at,status)').eq('barbershop_id', shopId).order('active', { ascending: false }).order('name');
  if (error) throw error;
  return data || [];
}

async function createProfessional(userId, input) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2) throw Object.assign(new Error('Informe o nome do profissional.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('professionals').insert({ barbershop_id: shopId, name: input.name.trim().slice(0, 100) }).select('id,name,active,created_at').single();
  if (error) throw error;
  return { ...data, appointments: [] };
}

async function updateProfessional(userId, professionalId, input) {
  const updates = {};
  if (typeof input.name === 'string') {
    if (input.name.trim().length < 2) throw Object.assign(new Error('Nome inválido.'), { status: 400 });
    updates.name = input.name.trim().slice(0, 100);
  }
  if (typeof input.active === 'boolean') updates.active = input.active;
  if (!Object.keys(updates).length) throw Object.assign(new Error('Nenhuma alteração enviada.'), { status: 400 });
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('professionals').update(updates).eq('id', professionalId).eq('barbershop_id', shopId).select('id,name,active,created_at').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Profissional não encontrado.'), { status: 404 });
  return data;
}

async function listReservations(userId) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('appointments').select('id,starts_at,duration_minutes,price_cents,status,created_at,clients(name,phone),services(name),professionals(name)').eq('barbershop_id', shopId).eq('status', 'pending').gte('starts_at', new Date().toISOString()).order('starts_at').limit(100);
  if (error) throw error;
  return data || [];
}

async function listCoupons(userId) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('coupons').select('id,code,discount_type,discount_value,min_order_cents,max_uses,uses_count,starts_at,ends_at,active,created_at').eq('barbershop_id', shopId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function couponPayload(input) {
  const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  if (code.length < 3) throw Object.assign(new Error('O código precisa ter pelo menos 3 caracteres.'), { status: 400 });
  const discountType = input.discountType === 'fixed' ? 'fixed' : 'percent';
  const rawValue = Number(input.discountValue);
  if (!Number.isFinite(rawValue) || rawValue <= 0 || (discountType === 'percent' && rawValue > 100)) throw Object.assign(new Error('Informe um desconto válido.'), { status: 400 });
  const maxUses = input.maxUses === '' || input.maxUses == null ? null : Math.round(Number(input.maxUses));
  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) throw Object.assign(new Error('O limite de usos é inválido.'), { status: 400 });
  const minimum = Math.max(0, Number(input.minimumOrder) || 0);
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) throw Object.assign(new Error('Confira o período de validade.'), { status: 400 });
  return {
    code,
    discount_type: discountType,
    discount_value: discountType === 'fixed' ? Math.round(rawValue * 100) : Math.round(rawValue),
    min_order_cents: Math.round(minimum * 100),
    max_uses: maxUses,
    starts_at: startsAt?.toISOString() || null,
    ends_at: endsAt?.toISOString() || null
  };
}

async function createCoupon(userId, input) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('coupons').insert({ barbershop_id: shopId, ...couponPayload(input) }).select('id,code,discount_type,discount_value,min_order_cents,max_uses,uses_count,starts_at,ends_at,active,created_at').single();
  if (error?.code === '23505') throw Object.assign(new Error('Já existe um cupom com este código.'), { status: 409 });
  if (error) throw error;
  return data;
}

async function updateCoupon(userId, couponId, input) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const updates = typeof input.active === 'boolean' && !input.code ? { active: input.active } : { ...couponPayload(input), ...(typeof input.active === 'boolean' ? { active: input.active } : {}) };
  const { data, error } = await db.from('coupons').update(updates).eq('id', couponId).eq('barbershop_id', shopId).select('id,code,discount_type,discount_value,min_order_cents,max_uses,uses_count,starts_at,ends_at,active,created_at').maybeSingle();
  if (error?.code === '23505') throw Object.assign(new Error('Já existe um cupom com este código.'), { status: 409 });
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Cupom não encontrado.'), { status: 404 });
  return data;
}

async function deleteCoupon(userId, couponId) {
  const db = getSupabaseClient();
  const shopId = await getShop(userId);
  const { data, error } = await db.from('coupons').delete().eq('id', couponId).eq('barbershop_id', shopId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Cupom não encontrado.'), { status: 404 });
}

module.exports = { dashboard, createAppointment, updateAppointmentStatus, listClients, createClient, listServices, createService, updateService, listProfessionals, createProfessional, updateProfessional, listReservations, listCoupons, createCoupon, updateCoupon, deleteCoupon };
