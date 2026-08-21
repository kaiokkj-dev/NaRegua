function appointmentEnd(startsAt, durationMinutes) {
  return new Date(new Date(startsAt).getTime() + durationMinutes * 60000);
}

async function assertNoAppointmentConflict(db, { barbershopId, professionalId, startsAt, durationMinutes }) {
  if (await hasAppointmentConflict(db, { barbershopId, professionalId, startsAt, durationMinutes })) {
    throw Object.assign(new Error('Este período já está ocupado para o profissional escolhido.'), { status: 409 });
  }
}

async function hasAppointmentConflict(db, { barbershopId, professionalId, startsAt, durationMinutes }) {
  const start = new Date(startsAt);
  const end = appointmentEnd(start, durationMinutes);
  const lookupStart = new Date(start.getTime() - 8 * 60 * 60000);
  let query = db.from('appointments').select('id,starts_at,duration_minutes').eq('barbershop_id', barbershopId).neq('status', 'cancelled').gte('starts_at', lookupStart.toISOString()).lt('starts_at', end.toISOString());
  if (professionalId) query = query.eq('professional_id', professionalId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).some(item => appointmentEnd(item.starts_at, item.duration_minutes) > start);
}

function translateAppointmentConflict(error) {
  if (error?.code === '23P01') return Object.assign(new Error('Este período acabou de ser ocupado. Escolha outro horário.'), { status: 409 });
  return error;
}

module.exports = { assertNoAppointmentConflict, hasAppointmentConflict, translateAppointmentConflict };
