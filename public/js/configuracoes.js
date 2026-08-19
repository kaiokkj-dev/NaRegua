import { renderSidebar } from './components/sidebar.js';
import { showToast } from './components/ui-feedback.js';

renderSidebar(document.querySelector('#dashboard-sidebar'));

const form = document.querySelector('[data-payment-settings-form]');
const errorTarget = document.querySelector('[data-settings-error]');
const hoursForm = document.querySelector('[data-hours-settings-form]');
const hoursTarget = document.querySelector('[data-business-hours]');
const hoursErrorTarget = document.querySelector('[data-hours-error]');
const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) return window.location.replace('/?auth=expired');
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'Nao foi possivel concluir.');
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
  return context;
}

async function loadSettings() {
  const settings = await api('/api/schedule/settings/payment');
  form.elements.enabled.checked = settings.enabled;
  form.elements.percent.value = settings.percent;
  form.elements.pixKey.value = settings.pixKey || '';
  form.elements.pixHolderName.value = settings.pixHolderName || '';
}

function renderHours(days) {
  hoursTarget.innerHTML = days.map(day => `
    <article class="hours-row" data-weekday="${day.weekday}">
      <div class="hours-day">
        <strong>${weekDays[day.weekday]}</strong>
        <label class="settings-toggle compact">
          <input type="checkbox" name="closed" ${day.closed ? 'checked' : ''}>
          <span></span>
          <b>Fechado</b>
        </label>
      </div>
      <div class="hours-fields">
        <label>Abre<input name="opensAt" type="time" value="${day.opensAt || '08:00'}"></label>
        <label>Fecha<input name="closesAt" type="time" value="${day.closesAt || '18:00'}"></label>
        <label>Intervalo<input name="slotIntervalMinutes" type="number" min="5" max="120" step="5" value="${day.slotIntervalMinutes || 30}"></label>
      </div>
      <div class="hours-break">
        <label class="settings-toggle compact">
          <input type="checkbox" name="breakEnabled" ${day.breakEnabled ? 'checked' : ''}>
          <span></span>
          <b>Almoço</b>
        </label>
        <label>De<input name="breakStartsAt" type="time" value="${day.breakStartsAt || '12:00'}"></label>
        <label>Até<input name="breakEndsAt" type="time" value="${day.breakEndsAt || '13:00'}"></label>
      </div>
    </article>
  `).join('');
}

async function loadHours() {
  const days = await api('/api/schedule/settings/hours');
  renderHours(days);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorTarget.textContent = '';
  const button = form.querySelector('[type="submit"]');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Salvando...';
  try {
    await api('/api/schedule/settings/payment', {
      method: 'PATCH',
      body: JSON.stringify({
        enabled: form.elements.enabled.checked,
        percent: form.elements.percent.value,
        pixKey: form.elements.pixKey.value,
        pixHolderName: form.elements.pixHolderName.value
      })
    });
    showToast('Configurações salvas.', 'success');
  } catch (error) {
    errorTarget.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

hoursForm.addEventListener('submit', async event => {
  event.preventDefault();
  hoursErrorTarget.textContent = '';
  const button = hoursForm.querySelector('[type="submit"]');
  const label = button.textContent;
  const days = [...hoursTarget.querySelectorAll('[data-weekday]')].map(row => ({
    weekday: Number(row.dataset.weekday),
    closed: row.querySelector('[name="closed"]').checked,
    opensAt: row.querySelector('[name="opensAt"]').value,
    closesAt: row.querySelector('[name="closesAt"]').value,
    slotIntervalMinutes: row.querySelector('[name="slotIntervalMinutes"]').value,
    breakEnabled: row.querySelector('[name="breakEnabled"]').checked,
    breakStartsAt: row.querySelector('[name="breakStartsAt"]').value,
    breakEndsAt: row.querySelector('[name="breakEndsAt"]').value
  }));
  button.disabled = true;
  button.textContent = 'Salvando...';
  try {
    renderHours(await api('/api/schedule/settings/hours', { method: 'PATCH', body: JSON.stringify({ days }) }));
    showToast('Horários salvos.', 'success');
  } catch (error) {
    hoursErrorTarget.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

(async () => {
  try {
    await loadUser();
    await loadSettings();
    await loadHours();
  } catch (error) {
    errorTarget.textContent = error.message;
    hoursErrorTarget.textContent = error.message;
  }
})();

document.querySelector('[data-sidebar-open]').addEventListener('click', () => document.body.classList.add('sidebar-open'));
document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
document.querySelector('[data-logout]').addEventListener('click', async event => {
  event.preventDefault();
  await api('/api/auth/logout', { method: 'POST' });
  location.replace('/');
});
