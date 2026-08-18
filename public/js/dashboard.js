import { renderSidebar } from './components/sidebar.js';

renderSidebar(document.querySelector('#dashboard-sidebar'));

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) return window.location.replace('/?auth=expired');
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'Não foi possível concluir a operação.');
  return body;
}

async function loadAuthenticatedUser() {
  let context = await api('/api/auth/me');
  const draftRaw = sessionStorage.getItem('naregua_onboarding');
  if (draftRaw && context.memberships.length === 0) {
    context = await api('/api/auth/onboarding', { method: 'POST', body: draftRaw });
    sessionStorage.removeItem('naregua_onboarding');
  }
  const firstName = context.user.name.split(/\s+/)[0];
  const userInitials = context.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  document.querySelectorAll('.user strong').forEach(element => { element.textContent = context.user.name; });
  document.querySelector('.user > span').textContent = userInitials;
  document.querySelector('[data-first-name]').textContent = firstName;
  const shopName = context.memberships[0]?.barbershops?.name;
  const shopSlug = context.memberships[0]?.barbershops?.slug;
  if (shopName) {
    document.querySelector('.shop-card strong').textContent = shopName;
    document.querySelector('.shop-card > span').textContent = shopName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
  if (shopSlug) {
    const path = `/agendar/${shopSlug}`;
    const bar = document.querySelector('[data-public-booking]');
    bar.hidden = false;
    document.querySelector('[data-public-url]').textContent = `${location.origin}${path}`;
    document.querySelector('[data-open-public-link]').href = path;
    document.querySelector('[data-copy-public-link]').onclick = async event => { await navigator.clipboard.writeText(`${location.origin}${path}`); event.currentTarget.textContent = 'Copiado!'; setTimeout(() => { event.currentTarget.textContent = 'Copiar link'; }, 1400); };
  }
}

function renderAppointments(items) {
  const target = document.querySelector('#appointments-list');
  if (!items.length) return void (target.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhum agendamento para hoje. Use “Novo agendamento” para começar.</td></tr>');
  target.innerHTML = items.map(item => {
    const client = item.clients || {};
    const initials = String(client.name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const status = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' }[item.status] || item.status;
    return `<tr><td><strong>${dateTime.format(new Date(item.starts_at))}</strong><small>${item.duration_minutes} min</small></td><td><div class="client"><span>${escapeHtml(initials)}</span><p><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.phone)}</small></p></div></td><td><strong>${escapeHtml(item.services?.name)}</strong></td><td><div class="professional">${escapeHtml(item.professionals?.name || 'A definir')}</div></td><td><em class="status ${escapeHtml(item.status)}">${escapeHtml(status)}</em></td><td><button>•••</button></td></tr>`;
  }).join('');
}

async function loadDashboard() {
  const { appointments, stats } = await api('/api/schedule/dashboard');
  renderAppointments(appointments);
  document.querySelector('[data-stat-total]').textContent = stats.total;
  document.querySelector('[data-stat-pending]').textContent = stats.pending;
  document.querySelector('[data-stat-revenue]').textContent = money.format(stats.revenueCents / 100);
  document.querySelector('[data-stat-clients]').textContent = stats.clients;
  document.querySelector('[data-summary-total]').textContent = stats.total + stats.cancelled;
  document.querySelector('[data-summary-confirmed]').textContent = stats.confirmed;
  document.querySelector('[data-summary-pending]').textContent = stats.pending;
  document.querySelector('[data-summary-cancelled]').textContent = stats.cancelled;
  const summaryTotal = Math.max(1, stats.total + stats.cancelled);
  const confirmedEnd = (stats.confirmed / summaryTotal) * 100;
  const pendingEnd = confirmedEnd + (stats.pending / summaryTotal) * 100;
  document.querySelector('.donut').style.background = `conic-gradient(var(--yellow) 0 ${confirmedEnd}%, #e0a600 ${confirmedEnd}% ${pendingEnd}%, #e7e7e9 ${pendingEnd}% 100%)`;
  const occupancy = Math.min(100, Math.round((stats.total / 12) * 100));
  document.querySelector('[data-occupancy]').textContent = `${occupancy}%`;
  document.querySelector('[data-occupancy-bar]').style.width = `${occupancy}%`;
  const next = appointments.find(item => new Date(item.starts_at) >= new Date() && item.status !== 'cancelled');
  document.querySelector('[data-next-time]').textContent = next ? dateTime.format(new Date(next.starts_at)) : '—';
  document.querySelector('[data-next-description]').textContent = next ? `${next.clients?.name} · ${next.services?.name}` : 'Nenhum horário futuro';
}

async function loadProfessionals() {
  const professionals = await api('/api/schedule/professionals');
  const select = document.querySelector('[data-professional-select]');
  select.innerHTML = '<option value="">A definir</option>' + professionals.filter(item => item.active).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
}

document.querySelector('[data-today-label]').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase();
const dialog = document.querySelector('[data-appointment-dialog]');
const form = document.querySelector('[data-appointment-form]');
document.querySelector('[data-new-appointment]').addEventListener('click', () => {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  form.elements.startsAt.value = local.toISOString().slice(0, 16);
  dialog.showModal();
});
document.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const error = document.querySelector('[data-dialog-error]');
  const originalLabel = submit.textContent;
  submit.disabled = true; submit.textContent = 'Salvando...'; error.textContent = '';
  try {
    await api('/api/schedule/appointments', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); dialog.close(); await loadDashboard();
  } catch (failure) { error.textContent = failure.message; }
  finally { submit.disabled = false; submit.textContent = originalLabel; }
});

const openSidebar = () => document.body.classList.add('sidebar-open');
const closeSidebar = () => document.body.classList.remove('sidebar-open');
document.querySelector('[data-sidebar-open]').addEventListener('click', openSidebar);
document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', closeSidebar));
document.querySelector('[data-logout]').addEventListener('click', async event => { event.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); window.location.replace('/'); });

Promise.all([loadAuthenticatedUser(), loadDashboard(), loadProfessionals()]).catch(error => {
  document.querySelector('#appointments-list').innerHTML = `<tr class="empty-row"><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
});
