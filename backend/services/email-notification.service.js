const { env } = require('../config/env');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' });

async function sendEmail({ to, subject, html }) {
  if (!env.emailNotificationsEnabled || !to) return { skipped: true };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html })
  });
  if (!response.ok) throw new Error(`Resend respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

function layout(content) {
  return `<!doctype html><html><body style="margin:0;background:#111214;color:#f4f4f5;font-family:Arial,sans-serif"><table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table width="100%" style="max-width:560px;border:1px solid #303136;background:#18191d"><tr><td style="padding:25px"><div style="color:#ffc400;font-size:22px;font-weight:800;margin-bottom:22px">NaRégua</div>${content}<p style="margin:24px 0 0;color:#777;font-size:12px">Mensagem automática de agendamento.</p></td></tr></table></td></tr></table></body></html>`;
}

function details(data) {
  return `<div style="padding:16px;border-left:3px solid #ffc400;background:#202126"><p style="margin:0 0 8px"><b>Serviço:</b> ${escapeHtml(data.serviceName)}</p><p style="margin:0 0 8px"><b>Data:</b> ${escapeHtml(dateTime.format(new Date(data.startsAt)))}</p><p style="margin:0 0 8px"><b>Profissional:</b> ${escapeHtml(data.professionalName || 'Qualquer profissional')}</p><p style="margin:0"><b>Valor:</b> ${escapeHtml(money.format(data.priceCents / 100))}</p></div>`;
}

async function sendBookingCreated(data) {
  const clientHtml = layout(`<h1 style="font-size:21px;margin:0 0 9px">${data.pending ? 'Reserva recebida' : 'Horário confirmado'}!</h1><p style="color:#b7b7bc;line-height:1.6">Olá, ${escapeHtml(data.clientName)}. Confira os dados do seu atendimento na ${escapeHtml(data.shopName)}.</p>${details(data)}`);
  const ownerHtml = layout(`<h1 style="font-size:21px;margin:0 0 9px">Novo agendamento</h1><p style="color:#b7b7bc;line-height:1.6"><b>${escapeHtml(data.clientName)}</b> acabou de reservar um horário. WhatsApp: ${escapeHtml(data.phone)}.</p>${details(data)}`);
  const results = await Promise.allSettled([
    sendEmail({ to: data.clientEmail, subject: `${data.pending ? 'Reserva recebida' : 'Horário confirmado'} — ${data.shopName}`, html: clientHtml }),
    sendEmail({ to: data.ownerEmail, subject: `Novo agendamento — ${data.clientName}`, html: ownerHtml })
  ]);
  results.filter(result => result.status === 'rejected').forEach(result => console.error('Falha ao enviar e-mail de agendamento:', result.reason?.message || result.reason));
}

module.exports = { sendBookingCreated };
