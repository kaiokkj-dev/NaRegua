import { renderSidebar } from './components/sidebar.js';
import { confirmAction, showToast } from './components/ui-feedback.js';

renderSidebar(document.querySelector('#dashboard-sidebar'));
const dateInput = document.querySelector('[data-agenda-date]');
const list = document.querySelector('[data-agenda-list]');
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const localDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
let currentAgenda = { appointments: [], stats: {} };

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) return window.location.replace('/?auth=expired');
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

async function loadUser() {
  const context = await api('/api/auth/me');
  const name = context.user.name;
  document.querySelector('.user strong').textContent = name;
  document.querySelector('.user > span').textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const shop = context.memberships[0]?.barbershops?.name;
  if (shop) {
    document.querySelector('.shop-card strong').textContent = shop;
    document.querySelector('.shop-card > span').textContent = shop.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
}

function render({ appointments, stats }) {
  currentAgenda = { appointments, stats };
  document.querySelector('[data-count-total]').textContent = stats.total + stats.cancelled;
  document.querySelector('[data-count-confirmed]').textContent = stats.confirmed;
  document.querySelector('[data-count-pending]').textContent = stats.pending;
  const selected = new Date(`${dateInput.value}T12:00:00`);
  document.querySelector('[data-agenda-title]').textContent = longDate.format(selected).replace(/^./, letter => letter.toUpperCase());
  if (!appointments.length) return void (list.innerHTML = '<div class="agenda-empty">Nenhum horário agendado neste dia.</div>');
  list.innerHTML = appointments.map(item => {
    const client = item.clients || {};
    const statusLabel = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' }[item.status];
    const actions = item.status === 'cancelled' ? '' : `<div class="agenda-actions">${item.status === 'pending' ? `<button class="confirm" data-status="confirmed" data-id="${item.id}">Confirmar</button>` : ''}${item.status !== 'completed' ? `<button data-status="completed" data-id="${item.id}">Concluir</button>` : ''}<button class="cancel" data-status="cancelled" data-id="${item.id}">Cancelar</button></div>`;
    return `<article class="agenda-item ${item.status}"><div class="agenda-time"><strong>${timeFormatter.format(new Date(item.starts_at))}</strong><small>${item.duration_minutes} min</small></div><div class="agenda-person"><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.phone)}</small></div><div class="agenda-service"><strong>${escapeHtml(item.services?.name)}</strong><small>${money.format(item.price_cents / 100)}</small></div><div class="agenda-professional"><span class="status ${item.status === 'pending' ? 'pending' : ''}">${statusLabel}</span></div>${actions}</article>`;
  }).join('');
}

async function loadAgenda() {
  list.innerHTML = '<div class="agenda-empty">Carregando agenda...</div>';
  try { render(await api(`/api/schedule/dashboard?date=${encodeURIComponent(dateInput.value)}`)); }
  catch (error) { list.innerHTML = `<div class="agenda-empty">${escapeHtml(error.message)}</div>`; }
}

dateInput.value = localDate(new Date());
dateInput.addEventListener('change', loadAgenda);
document.querySelector('[data-day-prev]').addEventListener('click', () => { const date = new Date(`${dateInput.value}T12:00:00`); date.setDate(date.getDate() - 1); dateInput.value = localDate(date); loadAgenda(); });
document.querySelector('[data-day-next]').addEventListener('click', () => { const date = new Date(`${dateInput.value}T12:00:00`); date.setDate(date.getDate() + 1); dateInput.value = localDate(date); loadAgenda(); });
list.addEventListener('click', async event => {
  const button = event.target.closest('[data-status]');
  if (!button) return;
  if (button.dataset.status === 'cancelled' && !await confirmAction({ title: 'Cancelar agendamento?', message: 'O horário será liberado novamente para outros clientes. Esta ação poderá ser consultada no histórico.', confirmLabel: 'Cancelar agendamento', danger: true })) return;
  const originalLabel = button.textContent;
  button.disabled = true; button.textContent = 'Salvando...';
  try {
    await api(`/api/schedule/appointments/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) });
    const updated = currentAgenda.appointments.map(item => item.id === button.dataset.id ? { ...item, status: button.dataset.status } : item);
    const active = updated.filter(item => item.status !== 'cancelled');
    render({ appointments: updated, stats: {
      ...currentAgenda.stats,
      total: active.length,
      confirmed: active.filter(item => item.status === 'confirmed').length,
      pending: active.filter(item => item.status === 'pending').length,
      cancelled: updated.filter(item => item.status === 'cancelled').length
    } });
  }
  catch (error) { showToast(error.message); button.disabled = false; button.textContent = originalLabel; }
});

document.querySelector('[data-sidebar-open]').addEventListener('click', () => document.body.classList.add('sidebar-open'));
document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
document.querySelector('[data-logout]').addEventListener('click', async event => { event.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); window.location.replace('/'); });

Promise.all([loadUser(), loadAgenda()]).catch(error => { list.innerHTML = `<div class="agenda-empty">${escapeHtml(error.message)}</div>`; });
