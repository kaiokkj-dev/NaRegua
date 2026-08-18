const items = [
  ['⌂', 'Dashboard'], ['▦', 'Agenda'], ['◷', 'Reservas'], ['♙', 'Clientes'],
  ['✂', 'Serviços'], ['♟', 'Profissionais'], ['⚙', 'Configurações']
];

export function renderSidebar(target) {
  target.innerHTML = `
    <div class="sidebar-brand"><a class="brand brand-light" href="/"><img src="/assets/images/logo-icon.png" alt=""><span>Na<strong>Régua</strong></span></a><button data-sidebar-close>✕</button></div>
    <div class="shop-card"><span>BR</span><div><strong>Barbearia do Rafa</strong><small>Plano profissional</small></div><b>⌄</b></div>
    <small class="nav-label">MENU PRINCIPAL</small>
    <nav class="sidebar-nav">${items.slice(0, 6).map(([icon, label], index) => `<a class="${index === 0 ? 'active' : ''}" href="#"><i>${icon}</i>${label}${label === 'Reservas' ? '<em>3</em>' : ''}</a>`).join('')}</nav>
    <small class="nav-label">PREFERÊNCIAS</small>
    <nav class="sidebar-nav">${items.slice(6).map(([icon, label]) => `<a href="#"><i>${icon}</i>${label}</a>`).join('')}<a href="/"><i>↗</i>Voltar ao site</a><a href="#" data-logout><i>⇥</i>Sair</a></nav>
    <div class="sidebar-help"><span>?</span><div><strong>Precisa de ajuda?</strong><small>Fale com nosso time</small></div><b>→</b></div>`;

  target.querySelectorAll('.sidebar-nav a[href="#"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    target.querySelectorAll('.sidebar-nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
  }));
}
