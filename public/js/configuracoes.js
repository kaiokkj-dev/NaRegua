import { renderSidebar } from './components/sidebar.js';
import { showToast } from './components/ui-feedback.js';

renderSidebar(document.querySelector('#dashboard-sidebar'));

const form = document.querySelector('[data-payment-settings-form]');
const errorTarget = document.querySelector('[data-settings-error]');
const hoursForm = document.querySelector('[data-hours-settings-form]');
const hoursTarget = document.querySelector('[data-business-hours]');
const hoursErrorTarget = document.querySelector('[data-hours-error]');
const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const timeInputAttrs = 'type="text" inputmode="numeric" autocomplete="off" maxlength="5" pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$" placeholder="HH:MM" class="time-24"';

function normalizeTime(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length <= 2) return digits.padStart(2, '0') + ':00';
  const hours = Number(digits.slice(0, -2));
  const minutes = Number(digits.slice(-2));
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function maskTime(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

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
        <label>Abre <small>24h</small><input name="opensAt" ${timeInputAttrs} value="${day.opensAt || '08:00'}"></label>
        <label>Fecha <small>24h</small><input name="closesAt" ${timeInputAttrs} value="${day.closesAt || '18:00'}"></label>
        <label>Intervalo<input name="slotIntervalMinutes" type="number" min="5" max="120" step="5" value="${day.slotIntervalMinutes || 30}"></label>
      </div>
      <div class="hours-break">
        <label class="settings-toggle compact">
          <input type="checkbox" name="breakEnabled" ${day.breakEnabled ? 'checked' : ''}>
          <span></span>
          <b data-break-label>${day.breakEnabled ? 'Pausa ativa' : 'Sem pausa'}</b>
        </label>
        <label data-break-field>De <small>24h</small><input name="breakStartsAt" ${timeInputAttrs} value="${day.breakStartsAt || '12:00'}"></label>
        <label data-break-field>Até <small>24h</small><input name="breakEndsAt" ${timeInputAttrs} value="${day.breakEndsAt || '13:00'}"></label>
      </div>
    </article>
  `).join('');
  hoursTarget.querySelectorAll('[data-weekday]').forEach(syncBreakState);
}

function syncBreakState(row) {
  const enabled = row.querySelector('[name="breakEnabled"]').checked;
  row.querySelector('[data-break-label]').textContent = enabled ? 'Pausa ativa' : 'Sem pausa';
  row.querySelectorAll('[data-break-field]').forEach(field => {
    field.classList.toggle('is-disabled', !enabled);
    field.querySelector('input').disabled = !enabled;
  });
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
  hoursTarget.querySelectorAll('.time-24').forEach(input => { input.value = normalizeTime(input.value); });
  if ([...hoursTarget.querySelectorAll('.time-24')].some(input => !input.value)) {
    hoursErrorTarget.textContent = 'Use horários no formato brasileiro, exemplo: 08:00, 12:00 ou 20:00.';
    return;
  }
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

hoursTarget.addEventListener('input', event => {
  if (!event.target.matches('.time-24')) return;
  event.target.value = maskTime(event.target.value);
});

hoursTarget.addEventListener('change', event => {
  if (!event.target.matches('[name="breakEnabled"]')) return;
  syncBreakState(event.target.closest('[data-weekday]'));
});

hoursTarget.addEventListener('blur', event => {
  if (!event.target.matches('.time-24')) return;
  event.target.value = normalizeTime(event.target.value);
}, true);

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
