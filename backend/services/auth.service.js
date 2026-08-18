const crypto = require('crypto');
const { getSupabaseClient } = require('../config/supabase');

async function findOrCreateGoogleUser({ googleSub, email, name, avatarUrl }) {
  const db = getSupabaseClient();
  const { data: byGoogle, error: googleError } = await db.from('users').select('*').eq('google_sub', googleSub).maybeSingle();
  if (googleError) throw googleError;
  if (byGoogle) {
    await db.from('users').update({ last_login_at: new Date().toISOString(), avatar_url: avatarUrl }).eq('id', byGoogle.id);
    return byGoogle;
  }
  const { data: byEmail, error: emailError } = await db.from('users').select('*').eq('email', email).maybeSingle();
  if (emailError) throw emailError;
  if (byEmail) {
    const { data, error } = await db.from('users').update({ google_sub: googleSub, avatar_url: avatarUrl, last_login_at: new Date().toISOString() }).eq('id', byEmail.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await db.from('users').insert({ google_sub: googleSub, email, name, avatar_url: avatarUrl }).select().single();
  if (error) throw error;
  return data;
}

async function getUserContext(userId) {
  const db = getSupabaseClient();
  const { data: user, error } = await db.from('users').select('id, name, email, avatar_url, created_at').eq('id', userId).single();
  if (error) throw error;
  const { data: memberships, error: membershipError } = await db.from('barbershop_members').select('role, barbershop_id, barbershops(id, name, slug, phone)').eq('user_id', userId);
  if (membershipError) throw membershipError;
  return { user, memberships: memberships || [] };
}

function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

async function completeOnboarding(userId, { name, phone, shop }) {
  if (![name, phone, shop].every(value => typeof value === 'string' && value.trim())) throw Object.assign(new Error('Dados de cadastro inválidos.'), { status: 400 });
  const db = getSupabaseClient();
  const { data: existing } = await db.from('barbershop_members').select('barbershop_id').eq('user_id', userId).limit(1).maybeSingle();
  if (existing) return getUserContext(userId);
  const slug = `${slugify(shop)}-${crypto.randomUUID().slice(0, 6)}`;
  const { error } = await db.rpc('create_barbershop_for_user', { p_user_id: userId, p_user_name: name.trim().slice(0, 100), p_shop_name: shop.trim().slice(0, 100), p_slug: slug, p_phone: phone.trim().slice(0, 30) });
  if (error) throw error;
  return getUserContext(userId);
}

module.exports = { findOrCreateGoogleUser, getUserContext, completeOnboarding };
