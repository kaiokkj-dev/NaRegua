import { renderSidebar } from './components/sidebar.js';
import { showToast } from './components/ui-feedback.js';

renderSidebar(document.querySelector('#dashboard-sidebar'));

const formatMoney = cents => cents ? (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Grátis';
const limitText = value => value == null ? 'Ilimitado' : String(value);

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) return location.replace('/?auth=expired');
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar os planos.');
  return data;
}

function trialDays(date) {
  if (!date) return 0;
  return Math.max(0, Math.ceil((new Date(date) - new Date()) / 86400000));
}

function renderSummary(data) {
  const { current, usage } = data;
  const trial = current.status === 'trialing';
  document.querySelector('[data-summary]').innerHTML = `
    <div class="subscription-current"><small>SEU PLANO</small><h2>${current.name}${trial ? ' em teste' : ''}</h2><p>${trial ? `${trialDays(current.trialEndsAt)} dias restantes no período gratuito.` : 'Sua assinatura está ativa.'}</p>${current.canManageBilling ? '<button class="manage-billing" data-manage-billing>Gerenciar assinatura →</button>' : ''}</div>
    <div class="usage-grid"><span><b>${usage.professionals}</b><small>de ${limitText(current.professionalLimit)} profissionais</small></span><span><b>${usage.appointmentsThisMonth}</b><small>de ${limitText(current.monthlyAppointmentLimit)} agendamentos no mês</small></span></div>`;
  document.querySelector('[data-manage-billing]')?.addEventListener('click', openBillingPortal);
}

async function openBillingPortal(event) {
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Abrindo portal...';
  try {
    const data = await api('/api/subscription/portal', { method: 'POST' });
    location.href = data.portalUrl;
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    showToast(error.message, 'error');
  }
}

function renderPlans(data) {
  document.querySelector('[data-plans]').innerHTML = data.plans.map(plan => {
    const active = plan.code === data.current.code;
    const features = [
      `${limitText(plan.professionalLimit)} ${plan.professionalLimit === 1 ? 'profissional' : 'profissionais'}`,
      `${limitText(plan.monthlyAppointmentLimit)} agendamentos por mês`,
      plan.features.coupons ? 'Cupons e sinal por Pix' : 'Agenda e página pública',
      plan.features.prioritySupport ? 'Suporte prioritário' : 'Gestão completa da rotina'
    ];
    return `<article class="plan-card ${plan.code === 'pro' ? 'featured' : ''}">${plan.code === 'pro' ? '<em>MAIS ESCOLHIDO</em>' : ''}<small>${plan.name.toUpperCase()}</small><h2>${formatMoney(plan.priceCents)}${plan.priceCents ? '<span>/mês</span>' : ''}</h2><p>${plan.code === 'essential' ? 'Para começar sem compromisso.' : plan.code === 'pro' ? 'Tudo para organizar uma equipe em crescimento.' : 'Mais escala e atendimento prioritário.'}</p><ul>${features.map(item => `<li>✓ ${item}</li>`).join('')}</ul><button data-plan="${plan.code}" ${active || !plan.priceCents ? 'disabled' : ''}>${active ? 'Plano atual' : plan.priceCents ? `Assinar ${plan.name}` : 'Plano gratuito'}</button></article>`;
  }).join('');
  document.querySelectorAll('[data-plan]:not(:disabled)').forEach(button => button.addEventListener('click', startCheckout));
}

async function startCheckout(event) {
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true; button.textContent = 'Abrindo pagamento...';
  try {
    const data = await api('/api/subscription/checkout', { method: 'POST', body: JSON.stringify({ plan: button.dataset.plan }) });
    location.href = data.checkoutUrl;
  } catch (error) {
    button.disabled = false; button.textContent = original; showToast(error.message, 'error');
  }
}

async function syncReturn() {
  const params = new URLSearchParams(location.search);
  if (params.get('checkout') !== 'success') return;
  const sessionId = params.get('session_id');
  if (!sessionId) return;
  try {
    await api('/api/subscription/sync', { method: 'POST', body: JSON.stringify({ sessionId }) });
    history.replaceState({}, '', '/assinatura?payment=success');
    showToast('Assinatura confirmada. Seu plano já está ativo.', 'success');
  } catch (_) { /* O webhook ainda poderá concluir a ativação com segurança. */ }
}

async function load() {
  try {
    await syncReturn();
    const [context, data] = await Promise.all([api('/api/auth/me'), api('/api/subscription')]);
    const name = context.user.name;
    document.querySelector('.user strong').textContent = name;
    document.querySelector('.user > span').textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const shop = context.memberships[0]?.barbershops?.name;
    if (shop) document.querySelector('.shop-card strong').textContent = shop;
    renderSummary(data); renderPlans(data);
  } catch (error) {
    document.querySelector('[data-summary]').innerHTML = `<p class="load-error">${error.message}</p>`;
  }
}

load();
