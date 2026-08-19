const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop());
const catalogScreen = document.querySelector('[data-catalog-screen]');
const scheduleScreen = document.querySelector('[data-schedule-screen]');
const detailsScreen = document.querySelector('[data-details-screen]');
const successScreen = document.querySelector('[data-booking-success]');
const serviceTarget = document.querySelector('[data-services]');
const professionalTarget = document.querySelector('[data-professionals]');
const professionalPicker = document.querySelector('[data-professional-picker]');
const daysTarget = document.querySelector('[data-days]');
const timesTarget = document.querySelector('[data-times]');
const form = document.querySelector('[data-booking-form]');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

let catalog;
let service;
let professionalId = '';
let selectedDate = '';
let selectedTime = '';
let couponCode = '';
let finalPriceCents = 0;

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Nao foi possivel concluir.');
  return body;
}

function localDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = String(Math.floor(value / 60)).padStart(2, '0');
  const minutes = String(value % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function dayFromDate(value) {
  return new Date(`${value}T12:00:00`).getDay();
}

function selectedBusinessHours() {
  const day = catalog.businessHours?.find(item => item.weekday === dayFromDate(selectedDate));
  if (day) return day;
  return { closed: false, opensAt: '08:00', closesAt: '18:00', breakEnabled: true, breakStartsAt: '12:00', breakEndsAt: '13:00', slotIntervalMinutes: 30 };
}

function slotOverlapsBreak(start, end, hours) {
  if (!hours.breakEnabled) return false;
  const breakStart = timeToMinutes(hours.breakStartsAt);
  const breakEnd = timeToMinutes(hours.breakEndsAt);
  return start < breakEnd && end > breakStart;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function formatPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validateFormFields() {
  const name = form.elements.name.value.trim().replace(/\s+/g, ' ');
  const phoneDigits = onlyDigits(form.elements.phone.value);
  if (name.length < 2 || /\d/.test(name) || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name)) return 'Digite seu nome sem números.';
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return 'Digite um WhatsApp válido com DDD.';
  if (catalog.shop.prepayment?.enabled && !form.elements.paidSignal.checked) return 'Confirme que você fez o Pix do sinal para continuar.';
  form.elements.name.value = name;
  form.elements.phone.value = formatPhone(phoneDigits);
  return '';
}

const clockIcon = '<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>';
const calendarIcon = '<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><circle cx="16.5" cy="16" r="2.5"/><path d="M16.5 14.7V16l1 .7"/></svg>';

function show(screen) {
  [catalogScreen, scheduleScreen, detailsScreen, successScreen].forEach(item => { item.hidden = item !== screen; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCatalog() {
  serviceTarget.innerHTML = catalog.services.map(item => `<article class="service-card"><div class="service-card-head"><h2>${escapeHtml(item.name)}</h2><span class="service-card-price">${money.format(item.price_cents / 100)}</span></div><span class="service-duration">${clockIcon}${item.duration_minutes} min</span><div class="service-card-foot"><span class="available">${clockIcon}Disponivel hoje</span><button type="button" data-book-service="${item.id}">${calendarIcon}Agendar</button></div></article>`).join('') || '<small>Nenhum servico disponivel.</small>';
  professionalTarget.innerHTML = catalog.professionals.map(item => `<article class="professional-card"><span class="avatar">${initials(item.name)}</span><div><h2>${escapeHtml(item.name)}</h2><small>Profissional disponivel</small></div><button type="button" data-book-professional="${item.id}">${calendarIcon}Ver horarios</button></article>`).join('') || '<small>Nenhum profissional cadastrado.</small>';
}

function renderProfessionals() {
  professionalPicker.innerHTML = `<button type="button" class="professional-choice ${professionalId ? '' : 'selected'}" data-pick-professional="">Qualquer profissional</button>` + catalog.professionals.map(item => `<button type="button" class="professional-choice ${professionalId === item.id ? 'selected' : ''}" data-pick-professional="${item.id}">${escapeHtml(item.name)}</button>`).join('');
}

function renderDays() {
  const formatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
  const days = [];
  for (let index = 0; index < 5; index += 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const value = localDate(date);
    days.push(`<button type="button" class="day-button ${selectedDate === value ? 'selected' : ''}" data-date="${value}"><span>${index === 0 ? 'HOJE' : formatter.format(date).replace('.', '').toUpperCase()}</span><strong>${date.getDate()}</strong></button>`);
  }
  daysTarget.innerHTML = days.join('');
}

function renderTimes() {
  const hours = selectedBusinessHours();
  if (hours.closed) {
    timesTarget.innerHTML = '<small>A barbearia nao abre neste dia.</small>';
    updateContinue();
    return;
  }
  const open = timeToMinutes(hours.opensAt);
  const close = timeToMinutes(hours.closesAt);
  const interval = Math.max(5, Number(hours.slotIntervalMinutes) || 30);
  const duration = Math.max(5, Number(service.duration_minutes) || 30);
  const now = new Date();
  const slots = [];
  for (let minute = open; minute + duration <= close; minute += interval) {
    if (!slotOverlapsBreak(minute, minute + duration, hours)) slots.push(minutesToTime(minute));
  }
  const breakStart = timeToMinutes(hours.breakStartsAt || '12:00');
  const groups = [
    ['Manha', slots.filter(time => timeToMinutes(time) < (hours.breakEnabled ? breakStart : 12 * 60))],
    ['Tarde', slots.filter(time => timeToMinutes(time) >= (hours.breakEnabled ? breakStart : 12 * 60))]
  ];
  timesTarget.innerHTML = groups.map(([label, times]) => {
    const valid = times.filter(time => new Date(`${selectedDate}T${time}:00`) > now);
    return valid.length ? `<div class="time-group"><small>${label} (${valid.length})</small><div class="time-grid">${valid.map(time => `<button type="button" class="${selectedTime === time ? 'selected' : ''}" data-time="${time}">${time}</button>`).join('')}</div></div>` : '';
  }).join('') || '<small>Nenhum horario disponivel para a duracao deste servico.</small>';
  updateContinue();
}

function updateContinue() {
  const button = document.querySelector('[data-continue]');
  button.disabled = !selectedTime;
  button.textContent = selectedTime ? 'Continuar ->' : 'Selecione um horario';
}

function openSchedule(chosenService, chosenProfessional = '') {
  service = chosenService;
  professionalId = chosenProfessional;
  selectedDate = localDate(new Date());
  selectedTime = '';
  couponCode = '';
  finalPriceCents = service.price_cents;
  document.querySelector('[data-selected-service]').innerHTML = `<strong>${escapeHtml(service.name)}</strong><small>1 servico · ${service.duration_minutes} min · ${money.format(service.price_cents / 100)}</small>`;
  renderProfessionals();
  renderDays();
  renderTimes();
  show(scheduleScreen);
}

function renderPaymentBox() {
  const payment = catalog.shop.prepayment;
  const box = document.querySelector('[data-payment-box]');
  const check = document.querySelector('[data-payment-check]');
  if (!payment?.enabled) {
    box.hidden = true;
    check.hidden = true;
    return;
  }
  const signalCents = Math.max(1, Math.round(finalPriceCents * payment.percent / 100));
  box.hidden = false;
  check.hidden = false;
  document.querySelector('[data-payment-amount]').textContent = money.format(signalCents / 100);
  document.querySelector('[data-pix-key]').textContent = payment.pixHolderName ? `${payment.pixHolderName} · ${payment.pixKey}` : payment.pixKey;
}

document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('[data-tab-panel]').forEach(panel => { panel.hidden = panel.dataset.tabPanel !== button.dataset.tab; });
}));

serviceTarget.addEventListener('click', event => {
  const button = event.target.closest('[data-book-service]');
  if (button) openSchedule(catalog.services.find(item => item.id === button.dataset.bookService));
});

professionalTarget.addEventListener('click', event => {
  const button = event.target.closest('[data-book-professional]');
  if (!button) return;
  const first = catalog.services[0];
  if (first) openSchedule(first, button.dataset.bookProfessional);
});

professionalPicker.addEventListener('click', event => {
  const button = event.target.closest('[data-pick-professional]');
  if (!button) return;
  professionalId = button.dataset.pickProfessional;
  renderProfessionals();
});

daysTarget.addEventListener('click', event => {
  const button = event.target.closest('[data-date]');
  if (!button) return;
  selectedDate = button.dataset.date;
  selectedTime = '';
  renderDays();
  renderTimes();
});

timesTarget.addEventListener('click', event => {
  const button = event.target.closest('[data-time]');
  if (!button) return;
  selectedTime = button.dataset.time;
  renderTimes();
});

document.querySelector('[data-back]').addEventListener('click', () => show(catalogScreen));
document.querySelector('[data-details-back]').addEventListener('click', () => show(scheduleScreen));
document.querySelector('[data-continue]').addEventListener('click', () => {
  if (!selectedTime) return;
  finalPriceCents = service.price_cents;
  const professional = catalog.professionals.find(item => item.id === professionalId);
  document.querySelector('[data-booking-review]').innerHTML = `<strong>${escapeHtml(service.name)}</strong><span>${selectedDate.split('-').reverse().join('/')} as ${selectedTime} · ${escapeHtml(professional?.name || 'Qualquer profissional')}</span><span>${service.duration_minutes} min · ${money.format(service.price_cents / 100)}</span>`;
  renderPaymentBox();
  show(detailsScreen);
});

document.querySelector('[data-copy-pix]').addEventListener('click', async event => {
  await navigator.clipboard.writeText(catalog.shop.prepayment.pixKey);
  event.currentTarget.textContent = 'Chave copiada';
  setTimeout(() => { event.currentTarget.textContent = 'Copiar chave Pix'; }, 1800);
});

form.elements.name.addEventListener('input', event => {
  event.target.value = event.target.value.replace(/[0-9]/g, '');
});

form.elements.phone.addEventListener('input', event => {
  event.target.value = formatPhone(event.target.value);
});

document.querySelector('[data-apply-coupon]').addEventListener('click', async event => {
  const input = document.querySelector('[data-coupon-code]');
  const message = document.querySelector('[data-coupon-message]');
  const details = input.closest('details');
  const button = event.currentTarget;
  message.textContent = '';
  message.classList.remove('coupon-success');
  details.classList.remove('coupon-applied');
  if (!input.value.trim()) return void (message.textContent = 'Digite um codigo.');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Validando...';
  try {
    const result = await api(`/api/public/shops/${encodeURIComponent(slug)}/coupons/validate`, { method: 'POST', body: JSON.stringify({ code: input.value, serviceId: service.id }) });
    couponCode = result.code;
    finalPriceCents = result.finalPriceCents;
    message.textContent = `Cupom aplicado: -${money.format(result.discountCents / 100)} · Total ${money.format(result.finalPriceCents / 100)}`;
    message.classList.add('coupon-success');
    details.classList.add('coupon-applied');
    const review = document.querySelector('[data-booking-review]');
    review.querySelector('[data-coupon-review]')?.remove();
    review.insertAdjacentHTML('beforeend', `<span data-coupon-review>Cupom ${escapeHtml(result.code)} · ${money.format(result.finalPriceCents / 100)}</span>`);
    renderPaymentBox();
  } catch (error) {
    couponCode = '';
    finalPriceCents = service.price_cents;
    renderPaymentBox();
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.querySelector('[data-booking-error]');
  const button = form.querySelector('[type="submit"]');
  const label = button.textContent;
  error.textContent = '';
  const validation = validateFormFields();
  if (validation) return void (error.textContent = validation);
  button.disabled = true;
  button.textContent = 'Confirmando...';
  try {
    const result = await api(`/api/public/shops/${encodeURIComponent(slug)}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ name: form.elements.name.value, phone: form.elements.phone.value, serviceId: service.id, professionalId, couponCode, notes: document.querySelector('[data-booking-notes]').value, startsAt: new Date(`${selectedDate}T${selectedTime}:00`).toISOString() })
    });
    if (result.status === 'pending') {
      document.querySelector('[data-success-title]').textContent = 'Reserva enviada!';
      document.querySelector('[data-success-message]').textContent = 'Seu horario ficou aguardando confirmacao do pagamento pela barbearia.';
    } else {
      document.querySelector('[data-success-title]').textContent = 'Horario confirmado!';
      document.querySelector('[data-success-message]').textContent = 'Seu atendimento ja entrou na agenda da barbearia.';
    }
    show(successScreen);
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

document.querySelector('[data-book-again]').addEventListener('click', () => location.reload());

(async () => {
  try {
    catalog = await api(`/api/public/shops/${encodeURIComponent(slug)}`);
    document.querySelector('[data-shop-name]').textContent = catalog.shop.name;
    document.querySelector('[data-shop-initial]').textContent = initials(catalog.shop.name).slice(0, 1);
    document.title = `Agendar em ${catalog.shop.name} - NaRegua`;
    renderCatalog();
  } catch (error) {
    document.querySelector('[data-shop-name]').textContent = 'Pagina indisponivel';
    serviceTarget.innerHTML = `<small>${escapeHtml(error.message)}</small>`;
  }
})();
