import { renderSidebar } from './components/sidebar.js';

const darkTheme = document.createElement('link');
darkTheme.rel = 'stylesheet';
darkTheme.href = '/css/dashboard-dark.css';
document.head.append(darkTheme);

renderSidebar(document.querySelector('#dashboard-sidebar'));
const list = document.querySelector('[data-clients-list]');
const dialog = document.querySelector('[data-client-dialog]');
const form = document.querySelector('[data-client-form]');
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
let searchTimer;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) return window.location.replace('/?auth=expired');
  const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Não foi possível concluir.'); return body;
}

async function loadUser() {
  const context = await api('/api/auth/me'); const name = context.user.name;
  document.querySelector('.user strong').textContent = name;
  document.querySelector('.user > span').textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const shop = context.memberships[0]?.barbershops?.name;
  if (shop) { document.querySelector('.shop-card strong').textContent = shop; document.querySelector('.shop-card > span').textContent = shop.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
}

function render(clients) {
  document.querySelector('[data-client-total]').textContent = clients.length;
  document.querySelector('[data-client-active]').textContent = clients.filter(client => client.appointments.length).length;
  if (!clients.length) return void (list.innerHTML = '<div class="clients-empty">Nenhum cliente encontrado.</div>');
  list.innerHTML = clients.map(client => {
    const appointments = client.appointments.filter(item => item.status !== 'cancelled').sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
    const initials = client.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const last = appointments[0];
    return `<article class="client-row"><div class="client-identity"><span class="client-avatar">${escapeHtml(initials)}</span><div><strong>${escapeHtml(client.name)}</strong><small>Cliente desde ${shortDate.format(new Date(client.created_at))}</small></div></div><div class="client-cell"><strong>${escapeHtml(client.phone)}</strong><small>WhatsApp</small></div><div class="client-cell"><strong>${appointments.length}</strong><small>agendamentos</small></div><div>${last ? `<span class="client-badge">Último: ${shortDate.format(new Date(last.starts_at))}</span>` : '<span class="client-badge">Novo cliente</span>'}</div></article>`;
  }).join('');
}

async function loadClients(query = '') { list.innerHTML = '<div class="clients-empty">Carregando...</div>'; try { render(await api(`/api/schedule/clients?q=${encodeURIComponent(query)}`)); } catch (error) { list.innerHTML = `<div class="clients-empty">${escapeHtml(error.message)}</div>`; } }
function bindSearch(input) { input.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadClients(input.value), 250); }); }
bindSearch(document.querySelector('[data-client-search]')); bindSearch(document.querySelector('[data-client-search-mobile]'));
document.querySelector('[data-new-client]').addEventListener('click', () => dialog.showModal());
document.querySelectorAll('[data-client-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
form.addEventListener('submit', async event => { event.preventDefault(); const button = form.querySelector('[type="submit"]'); const error = document.querySelector('[data-client-error]'); const label = button.textContent; button.disabled = true; button.textContent = 'Salvando...'; error.textContent = ''; try { await api('/api/schedule/clients', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); dialog.close(); await loadClients(); } catch (failure) { error.textContent = failure.message; } finally { button.disabled = false; button.textContent = label; } });
document.querySelector('[data-sidebar-open]').addEventListener('click', () => document.body.classList.add('sidebar-open')); document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', () => document.body.classList.remove('sidebar-open'))); document.querySelector('[data-logout]').addEventListener('click', async event => { event.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); location.replace('/'); });
Promise.all([loadUser(), loadClients()]);
