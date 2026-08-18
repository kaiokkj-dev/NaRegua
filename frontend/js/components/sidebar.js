import { icon, polishDashboardIcons } from './icons.js';
const items = [
  ['dashboard', 'Dashboard', '/dashboard'], ['calendar', 'Agenda', '/agenda'], ['clients', 'Clientes', '/clientes'],
  ['scissors', 'Serviços', '/servicos'], ['professional', 'Profissionais', '/profissionais'], ['coupon', 'Cupons', '/cupons'], ['settings', 'Configurações', '#']
];

export function renderSidebar(target) {
  target.innerHTML = `
    <div class="sidebar-brand"><a class="brand brand-light" href="/"><img src="/assets/images/logo-icon.png" alt=""><span>Na<strong>Régua</strong></span></a><button data-sidebar-close>${icon('close')}</button></div>
    <div class="shop-card"><span>BR</span><div><strong>Barbearia do Rafa</strong><small>Plano profissional</small></div><b>${icon('chevron')}</b></div>
    <small class="nav-label">MENU PRINCIPAL</small>
    <nav class="sidebar-nav">${items.slice(0, 6).map(([iconName, label, href]) => `<a class="${location.pathname === href ? 'active' : ''}" href="${href}"><i>${icon(iconName)}</i>${label}</a>`).join('')}</nav>
    <small class="nav-label">PREFERÊNCIAS</small>
    <nav class="sidebar-nav">${items.slice(6).map(([iconName, label, href]) => `<a href="${href}"><i>${icon(iconName)}</i>${label}</a>`).join('')}<a href="/"><i>${icon('external')}</i>Voltar ao site</a><a href="#" data-logout><i>${icon('logout')}</i>Sair</a></nav>
    <div class="sidebar-help"><span>?</span><div><strong>Precisa de ajuda?</strong><small>Fale com nosso time</small></div><b>→</b></div>`;

  polishDashboardIcons(document);
  target.querySelectorAll('.sidebar-nav a[href="#"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    target.querySelectorAll('.sidebar-nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
  }));

}
