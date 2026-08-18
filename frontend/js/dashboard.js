import { renderSidebar } from './components/sidebar.js';

const appointments = [
  { time: '10:30', initials: 'MO', name: 'Marcos Oliveira', phone: '(11) 98845-1234', service: 'Corte + Barba', duration: '60 min', professional: 'Rafael', color: 'blue', status: 'Confirmado' },
  { time: '11:15', initials: 'JP', name: 'João Pedro', phone: '(11) 97720-8891', service: 'Corte degradê', duration: '45 min', professional: 'Bruno', color: 'purple', status: 'Confirmado' },
  { time: '12:00', initials: 'CL', name: 'Carlos Lima', phone: '(11) 96541-3302', service: 'Barba', duration: '30 min', professional: 'Rafael', color: 'blue', status: 'Pendente' },
  { time: '13:30', initials: 'AS', name: 'André Souza', phone: '(11) 99872-4501', service: 'Corte clássico', duration: '45 min', professional: 'Lucas', color: 'green', status: 'Confirmado' }
];

renderSidebar(document.querySelector('#dashboard-sidebar'));

async function loadAuthenticatedUser() {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!response.ok) return window.location.replace('/?auth=expired');
  let context = await response.json();
  const draftRaw = sessionStorage.getItem('naregua_onboarding');
  if (draftRaw && context.memberships.length === 0) {
    const onboardingResponse = await fetch('/api/auth/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: draftRaw });
    if (onboardingResponse.ok) {
      context = await onboardingResponse.json();
      sessionStorage.removeItem('naregua_onboarding');
    }
  }
  document.querySelectorAll('.user strong').forEach(element => { element.textContent = context.user.name; });
  const shopName = context.memberships[0]?.barbershops?.name;
  if (shopName) document.querySelector('.shop-card strong').textContent = shopName;
}

loadAuthenticatedUser().catch(() => window.location.replace('/?auth=error'));

document.querySelector('#appointments-list').innerHTML = appointments.map(item => `
  <tr><td><strong>${item.time}</strong><small>${item.duration}</small></td><td><div class="client"><span>${item.initials}</span><p><strong>${item.name}</strong><small>${item.phone}</small></p></div></td><td><strong>${item.service}</strong></td><td><div class="professional"><i class="${item.color}"></i>${item.professional}</div></td><td><em class="status ${item.status === 'Pendente' ? 'pending' : ''}">${item.status}</em></td><td><button>•••</button></td></tr>`).join('');

const sidebar = document.querySelector('#dashboard-sidebar');
const openSidebar = () => document.body.classList.add('sidebar-open');
const closeSidebar = () => document.body.classList.remove('sidebar-open');
document.querySelector('[data-sidebar-open]').addEventListener('click', openSidebar);
document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', closeSidebar));
document.querySelector('[data-logout]').addEventListener('click', async event => {
  event.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.replace('/');
});
