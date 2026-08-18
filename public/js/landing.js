document.querySelector('#year').textContent = new Date().getFullYear();

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) entry.target.classList.add('visible');
}), { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

const teamPrices = {
  1: { pro: 29.9, black: 59.9, label: 'Para 1 profissional' },
  3: { pro: 49.9, black: 99.9, label: 'Para até 3 profissionais' },
  6: { pro: 79.9, black: 149.9, label: 'Para até 6 profissionais' },
  10: { pro: 119.9, black: 219.9, label: 'Para equipes com 10+ profissionais' }
};

let selectedTeam = 1;
let selectedBilling = 'monthly';

function formatPrice(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function updatePrices() {
  const plan = teamPrices[selectedTeam];
  const discount = selectedBilling === 'annual' ? 0.8 : 1;
  document.querySelector('[data-pro-price]').textContent = formatPrice(plan.pro * discount);
  document.querySelector('[data-black-price]').textContent = formatPrice(plan.black * discount);
  document.querySelector('[data-pro-caption]').textContent = `${plan.label}${selectedBilling === 'annual' ? ' · cobrado anualmente' : ''}`;
  document.querySelector('[data-black-caption]').textContent = `${plan.label}${selectedBilling === 'annual' ? ' · cobrado anualmente' : ''}`;
}

document.querySelectorAll('[data-team]').forEach(button => button.addEventListener('click', () => {
  selectedTeam = Number(button.dataset.team);
  document.querySelectorAll('[data-team]').forEach(item => item.classList.toggle('active', item === button));
  updatePrices();
}));

document.querySelectorAll('[data-billing]').forEach(button => button.addEventListener('click', () => {
  selectedBilling = button.dataset.billing;
  document.querySelectorAll('[data-billing]').forEach(item => item.classList.toggle('active', item === button));
  updatePrices();
}));

updatePrices();

const signupForm = document.querySelector('#signup-form');
const formFeedback = signupForm.querySelector('.form-feedback');

signupForm.addEventListener('submit', event => {
  event.preventDefault();
  const fields = [...signupForm.querySelectorAll('input')];
  fields.forEach(field => field.classList.toggle('invalid', !field.validity.valid));
  const invalid = fields.find(field => !field.validity.valid);

  if (invalid) {
    formFeedback.className = 'form-feedback';
    formFeedback.textContent = 'Preencha os campos corretamente para continuar.';
    invalid.focus();
    return;
  }

  sessionStorage.setItem('naregua_onboarding', JSON.stringify(Object.fromEntries(new FormData(signupForm))));
  window.location.assign('/api/auth/google');
});

signupForm.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', () => {
  window.location.assign('/api/auth/google');
}));

const authError = new URLSearchParams(window.location.search).get('auth_error');
if (authError) {
  const messages = { not_configured: 'Configure Google e Supabase no arquivo .env para ativar o login.', invalid_state: 'A tentativa de login expirou. Tente novamente.', google: 'Não foi possível entrar com o Google.' };
  formFeedback.textContent = messages[authError] || 'Não foi possível iniciar a autenticação.';
}

const demoContent = {service:`<small>ESCOLHA UM SERVIÇO</small><div class="phone-option active"><span><strong>Corte</strong><small>◷ 45 min</small></span><b>R$ 45</b></div><div class="phone-option"><span><strong>Barba</strong><small>◷ 30 min</small></span><b>R$ 35</b></div><div class="phone-option"><span><strong>Corte + Barba</strong><small>◷ 60 min</small></span><b>R$ 70</b></div>`,time:`<small>ESCOLHA DATA E HORÁRIO</small><div class="phone-days"><b>SEG<small>17</small></b><b class="active">TER<small>18</small></b><b>QUA<small>19</small></b><b>QUI<small>20</small></b></div><div class="phone-times"><span>09:00</span><span>10:30</span><span class="active">11:15</span><span>13:30</span><span>14:15</span><span>16:00</span></div>`,confirm:`<div class="phone-success"><i>✓</i><strong>Horário confirmado!</strong><p>Terça, 18 de agosto às 11:15</p><span>Corte · Rafael</span><small>O lembrete será enviado automaticamente pelo WhatsApp.</small></div>`,manage:`<small>NOVO AGENDAMENTO</small><div class="phone-admin"><div><span>11:15</span><p><strong>Marcos Oliveira</strong><small>Corte · Rafael</small></p><em>Confirmado</em></div><div class="phone-admin-stat"><span><small>HOJE</small><strong>12</strong></span><span><small>RECEITA</small><strong>R$ 860</strong></span></div></div>`};
document.querySelectorAll('[data-demo-steps] button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-demo-steps] button').forEach(item=>item.classList.toggle('active',item===button));document.querySelector('[data-phone-screen]').innerHTML=demoContent[button.dataset.step]}));

const floatingCta = document.querySelector('.pricing-bottom');
const heroSection = document.querySelector('.hero');
const pageFooter = document.querySelector('footer');
let scrollTicking = false;
let footerInView = false;

function updateFloatingCta() {
  const triggerPoint = heroSection.offsetHeight * 0.72;
  const footerIsVisible = footerInView || pageFooter.getBoundingClientRect().top <= window.innerHeight;
  const reachedPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24;
  const shouldShow = window.scrollY > triggerPoint && !footerIsVisible && !reachedPageEnd;
  floatingCta.classList.toggle('is-visible', shouldShow);
  scrollTicking = false;
}

window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(updateFloatingCta);
    scrollTicking = true;
  }
}, { passive: true });

updateFloatingCta();

const footerObserver = new IntersectionObserver(entries => {
  footerInView = entries[0].isIntersecting;
  updateFloatingCta();
}, { threshold: 0 });
footerObserver.observe(pageFooter);
