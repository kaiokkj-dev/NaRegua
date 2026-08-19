const SAO_PAULO_TZ = 'America/Sao_Paulo';
const WEEKDAY_FROM_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function trimTime(value) {
  return String(value || '').slice(0, 5);
}

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value || ''));
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

function defaultBusinessHours(shopId) {
  return Array.from({ length: 7 }, (_, weekday) => ({
    barbershop_id: shopId,
    weekday,
    closed: weekday === 0,
    opens_at: '08:00',
    closes_at: weekday === 6 ? '14:00' : '18:00',
    break_enabled: weekday >= 1 && weekday <= 5,
    break_starts_at: '12:00',
    break_ends_at: '13:00',
    slot_interval_minutes: 30
  }));
}

function toPublicHours(row) {
  return {
    weekday: row.weekday,
    closed: Boolean(row.closed),
    opensAt: trimTime(row.opens_at),
    closesAt: trimTime(row.closes_at),
    breakEnabled: Boolean(row.break_enabled),
    breakStartsAt: trimTime(row.break_starts_at),
    breakEndsAt: trimTime(row.break_ends_at),
    slotIntervalMinutes: row.slot_interval_minutes || 30
  };
}

function validateDay(input, shopId) {
  const weekday = Math.round(Number(input.weekday));
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw Object.assign(new Error('Dia da semana inválido.'), { status: 400 });
  const opensAt = trimTime(input.opensAt || input.opens_at || '08:00');
  const closesAt = trimTime(input.closesAt || input.closes_at || '18:00');
  const breakStartsAt = trimTime(input.breakStartsAt || input.break_starts_at || '12:00');
  const breakEndsAt = trimTime(input.breakEndsAt || input.break_ends_at || '13:00');
  const openMinutes = timeToMinutes(opensAt);
  const closeMinutes = timeToMinutes(closesAt);
  const breakStartMinutes = timeToMinutes(breakStartsAt);
  const breakEndMinutes = timeToMinutes(breakEndsAt);
  const slotInterval = Math.round(Number(input.slotIntervalMinutes || input.slot_interval_minutes || 30));
  const breakEnabled = Boolean(input.breakEnabled ?? input.break_enabled);

  if ([openMinutes, closeMinutes, breakStartMinutes, breakEndMinutes].some(Number.isNaN)) throw Object.assign(new Error('Confira os horários informados.'), { status: 400 });
  if (openMinutes >= closeMinutes) throw Object.assign(new Error('O horário de abertura precisa ser antes do fechamento.'), { status: 400 });
  if (breakEnabled && (breakStartMinutes <= openMinutes || breakEndMinutes >= closeMinutes || breakStartMinutes >= breakEndMinutes)) {
    throw Object.assign(new Error('O almoço precisa ficar dentro do expediente.'), { status: 400 });
  }
  if (!Number.isFinite(slotInterval) || slotInterval < 5 || slotInterval > 120) throw Object.assign(new Error('O intervalo dos horários precisa ficar entre 5 e 120 minutos.'), { status: 400 });

  return {
    barbershop_id: shopId,
    weekday,
    closed: Boolean(input.closed),
    opens_at: opensAt,
    closes_at: closesAt,
    break_enabled: breakEnabled,
    break_starts_at: breakStartsAt,
    break_ends_at: breakEndsAt,
    slot_interval_minutes: slotInterval,
    updated_at: new Date().toISOString()
  };
}

async function getBusinessHoursForShop(db, shopId) {
  const fields = 'weekday,closed,opens_at,closes_at,break_enabled,break_starts_at,break_ends_at,slot_interval_minutes';
  let { data, error } = await db.from('business_hours').select(fields).eq('barbershop_id', shopId).order('weekday');
  if (error) throw error;
  const rows = data || [];
  const missing = defaultBusinessHours(shopId).filter(day => !rows.some(row => row.weekday === day.weekday));
  if (missing.length) {
    const created = await db.from('business_hours').upsert(missing, { onConflict: 'barbershop_id,weekday' });
    if (created.error) throw created.error;
    const fresh = await db.from('business_hours').select(fields).eq('barbershop_id', shopId).order('weekday');
    if (fresh.error) throw fresh.error;
    data = fresh.data || [];
  }
  return (data || []).map(toPublicHours);
}

async function updateBusinessHoursForShop(db, shopId, days) {
  if (!Array.isArray(days) || !days.length) throw Object.assign(new Error('Envie ao menos um dia de funcionamento.'), { status: 400 });
  const payload = days.map(day => validateDay(day, shopId));
  const seen = new Set(payload.map(day => day.weekday));
  if (seen.size !== payload.length) throw Object.assign(new Error('Existe dia repetido nos horários.'), { status: 400 });
  const { error } = await db.from('business_hours').upsert(payload, { onConflict: 'barbershop_id,weekday' });
  if (error) throw error;
  return getBusinessHoursForShop(db, shopId);
}

function getLocalParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return {
    weekday: WEEKDAY_FROM_SHORT[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

async function assertWithinBusinessHours(db, { barbershopId, startsAt, durationMinutes }) {
  const days = await getBusinessHoursForShop(db, barbershopId);
  const local = getLocalParts(new Date(startsAt));
  const day = days.find(item => item.weekday === local.weekday);
  if (!day || day.closed) throw Object.assign(new Error('A barbearia está fechada neste dia.'), { status: 400 });

  const startMinutes = local.minutes;
  const endMinutes = startMinutes + Math.round(Number(durationMinutes) || 30);
  const openMinutes = timeToMinutes(day.opensAt);
  const closeMinutes = timeToMinutes(day.closesAt);
  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw Object.assign(new Error('Este serviço não cabe dentro do horário de funcionamento.'), { status: 400 });
  }
  if (day.breakEnabled) {
    const breakStart = timeToMinutes(day.breakStartsAt);
    const breakEnd = timeToMinutes(day.breakEndsAt);
    if (startMinutes < breakEnd && endMinutes > breakStart) {
      throw Object.assign(new Error('Este horário atravessa o intervalo de almoço.'), { status: 400 });
    }
  }
}

module.exports = { getBusinessHoursForShop, updateBusinessHoursForShop, assertWithinBusinessHours };
