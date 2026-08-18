function appointmentEnd(startsAt, durationMinutes) {
  return new Date(new Date(startsAt).getTime() + durationMinutes * 60000);
}

async function assertNoAppointmentConflict(db, { barbershopId, professionalId, startsAt, durationMinutes }) {
  if (!professionalId) return;
  const start = new Date(startsAt);
  const end = appointmentEnd(start, durationMinutes);
  const lookupStart = new Date(start.getTime() - 8 * 60 * 60000);
  const { data, error } = await db.from('appointments').select('id,starts_at,duration_minutes').eq('barbershop_id', barbershopId).eq('professional_id', professionalId).neq('status', 'cancelled').gte('starts_at', lookupStart.toISOString()).lt('starts_at', end.toISOString());
  if (error) throw error;
  const conflict = (data || []).some(item => appointmentEnd(item.starts_at, item.duration_minutes) > start);
  if (conflict) throw Object.assign(new Error('Este período já está ocupado para o profissional escolhido.'), { status: 409 });
}

function translateAppointmentConflict(error) {
  if (error?.code === '23P01') return Object.assign(new Error('Este período acabou de ser ocupado. Escolha outro horário.'), { status: 409 });
  return error;
}

module.exports = { assertNoAppointmentConflict, translateAppointmentConflict };
