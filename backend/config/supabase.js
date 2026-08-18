const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');

let client;

function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

function getSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('As credenciais do Supabase ainda não foram configuradas.');
  }

  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return client;
}

module.exports = { getSupabaseClient, isSupabaseConfigured };
