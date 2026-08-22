import { icon, polishDashboardIcons } from './icons.js';
const mainItems = [
  ['dashboard', 'Dashboard', '/dashboard'], ['calendar', 'Agenda', '/agenda'], ['reservation', 'Reservas', '/reservas'],
  ['clients', 'Clientes', '/clientes'], ['scissors', 'Serviços', '/servicos'], ['professional', 'Profissionais', '/profissionais'], ['coupon', 'Cupons', '/cupons']
];
const preferenceItems = [['money', 'Planos e assinatura', '/assinatura'], ['settings', 'Configurações', '/configuracoes']];
const helpUrl = 'https://wa.me/5511994495536?text=Oi%2C%20preciso%20de%20ajuda%20com%20o%20NaR%C3%A9gua.';
let reservationRefreshTimer;

export function renderSidebar(target) {
  if (!document.querySelector('link[data-sidebar-styles]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/css/sidebar-menu.css';
    stylesheet.dataset.sidebarStyles = 'true';
    document.head.appendChild(stylesheet);
  }
  target.innerHTML = `
    <div class="sidebar-brand"><a class="brand brand-light" href="/"><img src="/assets/images/logo-icon.png" alt=""><span>Na<strong>Régua</strong></span></a><button data-sidebar-close>${icon('close')}</button></div>
    <button class="shop-card" type="button" data-shop-menu-trigger aria-expanded="false"><span>BR</span><div><strong>Barbearia do Rafa</strong><small>Plano profissional</small></div><b>${icon('chevron')}</b></button>
    <div class="shop-menu" data-shop-menu hidden>
      <a href="/configuracoes">${icon('settings')} Ajustes da barbearia</a>
      <a href="/reservas">${icon('reservation')} Reservas pendentes</a>
      <a href="/cupons">${icon('coupon')} Cupons e descontos</a>
      <a href="/agenda">${icon('calendar')} Ver agenda</a>
    </div>
    <small class="nav-label">MENU PRINCIPAL</small>
    <nav class="sidebar-nav">${mainItems.map(([iconName, label, href]) => `<a class="${location.pathname === href ? 'active' : ''}" href="${href}"><i>${icon(iconName)}</i>${label}${href === '/reservas' ? '<em data-reservation-count hidden>0</em>' : ''}</a>`).join('')}</nav>
    <small class="nav-label">PREFERÊNCIAS</small>
    <nav class="sidebar-nav">${preferenceItems.map(([iconName, label, href]) => `<a class="${location.pathname === href ? 'active' : ''}" href="${href}"><i>${icon(iconName)}</i>${label}</a>`).join('')}<a href="/"><i>${icon('external')}</i>Voltar ao site</a><a href="#" data-logout><i>${icon('logout')}</i>Sair</a></nav>
    <a class="sidebar-help" href="${helpUrl}" target="_blank" rel="noopener"><span>?</span><div><strong>Precisa de ajuda?</strong><small>Fale conosco no WhatsApp</small></div><b>→</b></a>`;

  polishDashboardIcons(document);
  initDashboardChrome();
  startReservationNotifications();
  refreshSubscriptionLabel();
  target.querySelector('[data-logout]')?.addEventListener('click', requestLogout, { capture: true });
  target.querySelectorAll('.sidebar-nav a[href="#"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    target.querySelectorAll('.sidebar-nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
  }));

}

function ensureLogoutDialog() {
  let dialog = document.querySelector('[data-logout-dialog]');
  if (dialog) return dialog;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="logout-dialog" data-logout-dialog hidden>
      <div class="logout-dialog-card" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <small>CONFIRMAR SAÍDA</small>
        <h2 id="logout-title">Deseja sair da conta?</h2>
        <p>Você vai voltar para a página inicial e precisará entrar novamente para acessar o painel.</p>
        <div>
          <button type="button" data-logout-cancel>Continuar aqui</button>
          <button type="button" data-logout-confirm>Sair da conta</button>
        </div>
      </div>
    </div>`);
  dialog = document.querySelector('[data-logout-dialog]');
  dialog.querySelector('[data-logout-cancel]').addEventListener('click', () => { dialog.hidden = true; });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.hidden = true;
  });
  dialog.querySelector('[data-logout-confirm]').addEventListener('click', performLogout);
  return dialog;
}

function requestLogout(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  closeFloatingMenus();
  ensureLogoutDialog().hidden = false;
}

async function performLogout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  location.replace('/');
}

function closeFloatingMenus(except) {
  document.querySelectorAll('[data-shop-menu],[data-notification-menu],[data-user-menu]').forEach(menu => {
    if (menu !== except) menu.hidden = true;
  });
  document.querySelectorAll('[data-shop-menu-trigger],[data-notification-trigger],[data-user-menu-trigger]').forEach(trigger => {
    if (trigger.getAttribute('aria-controls') !== except?.id) trigger.setAttribute('aria-expanded', 'false');
  });
  updateFloatingMenuState();
}

async function refreshSubscriptionLabel() {
  try {
    const response = await fetch('/api/subscription', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    const overview = await response.json();
    const label = document.querySelector('.shop-card small');
    if (label) label.textContent = overview.current.status === 'trialing' ? `Teste ${overview.current.name}` : `Plano ${overview.current.name}`;
  } catch (_) { /* O menu continua utilizável sem o resumo da assinatura. */ }
}

function applyReservationCount(count) {
  document.querySelectorAll('[data-reservation-count]').forEach(badge => {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  });
  const trigger = document.querySelector('[data-notification-trigger]');
  trigger?.classList.toggle('has-notifications', count > 0);
  trigger?.setAttribute('aria-label', count ? `${count} reservas aguardando confirmação` : 'Nenhuma reserva pendente');
  const menu = document.querySelector('[data-notification-menu]');
  if (menu) {
    menu.querySelector('[data-notification-title]').textContent = count ? `${count} ${count === 1 ? 'reserva pendente' : 'reservas pendentes'}` : 'Nenhuma urgência agora';
    menu.querySelector('[data-notification-copy]').textContent = count ? 'Há solicitações esperando sua confirmação.' : 'Novas reservas e avisos importantes aparecerão aqui.';
  }
}

export async function refreshReservationNotifications() {
  try {
    const response = await fetch('/api/schedule/reservations', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    const reservations = await response.json();
    applyReservationCount(Array.isArray(reservations) ? reservations.length : 0);
  } catch (_) { /* Mantém o painel utilizável se a atualização falhar. */ }
}

function startReservationNotifications() {
  refreshReservationNotifications();
  clearInterval(reservationRefreshTimer);
  reservationRefreshTimer = setInterval(refreshReservationNotifications, 30000);
  if (!document.body.dataset.reservationNotificationsReady) {
    document.body.dataset.reservationNotificationsReady = 'true';
    window.addEventListener('focus', refreshReservationNotifications);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshReservationNotifications(); });
    document.addEventListener('reservations:changed', refreshReservationNotifications);
  }
}

function toggleMenu(trigger, menu) {
  const willOpen = menu.hidden;
  closeFloatingMenus(menu);
  menu.hidden = !willOpen;
  trigger.setAttribute('aria-expanded', String(willOpen));
  updateFloatingMenuState();
}

function updateFloatingMenuState() {
  const hasOpenMenu = Boolean(document.querySelector('[data-shop-menu]:not([hidden]),[data-notification-menu]:not([hidden]),[data-user-menu]:not([hidden])'));
  document.body.classList.toggle('floating-menu-open', hasOpenMenu);
}

function initDashboardChrome() {
  const sidebarOpen = document.querySelector('[data-sidebar-open]');
  if (sidebarOpen && !sidebarOpen.dataset.sidebarReady) {
    sidebarOpen.dataset.sidebarReady = 'true';
    sidebarOpen.addEventListener('click', () => document.body.classList.add('sidebar-open'));
  }

  document.querySelectorAll('[data-sidebar-close]').forEach(button => {
    if (button.dataset.sidebarReady) return;
    button.dataset.sidebarReady = 'true';
    button.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  document.querySelectorAll('#dashboard-sidebar a').forEach(link => {
    if (link.dataset.sidebarNavigationReady) return;
    link.dataset.sidebarNavigationReady = 'true';
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 800px)').matches) document.body.classList.remove('sidebar-open');
    });
  });

  const shopTrigger = document.querySelector('[data-shop-menu-trigger]');
  const shopMenu = document.querySelector('[data-shop-menu]');
  if (shopTrigger && shopMenu && !shopTrigger.dataset.ready) {
    shopMenu.id = 'shop-menu';
    shopTrigger.dataset.ready = 'true';
    shopTrigger.setAttribute('aria-controls', shopMenu.id);
    shopTrigger.addEventListener('click', event => {
      event.stopPropagation();
      toggleMenu(shopTrigger, shopMenu);
    });
  }

  const headerActions = document.querySelector('.header-actions');
  let notificationButton = headerActions?.querySelector(':scope > button');
  if (headerActions && !notificationButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'notification-trigger';
    button.setAttribute('aria-label', 'Notificações');
    button.innerHTML = `${icon('bell')}<i></i><em data-reservation-count hidden>0</em>`;
    headerActions.prepend(button);
    notificationButton = button;
  }
  if (notificationButton && !notificationButton.dataset.notificationTrigger) {
    notificationButton.classList.add('notification-trigger');
    notificationButton.dataset.notificationTrigger = 'true';
    notificationButton.type = 'button';
    notificationButton.setAttribute('aria-expanded', 'false');
    if (!notificationButton.querySelector('[data-reservation-count]')) notificationButton.insertAdjacentHTML('beforeend', '<em data-reservation-count hidden>0</em>');
    notificationButton.insertAdjacentHTML('afterend', `
      <div class="notification-menu" id="notification-menu" data-notification-menu hidden>
        <small>CENTRAL</small>
        <strong data-notification-title>Nenhuma urgência agora</strong>
        <p data-notification-copy>Novas reservas e avisos importantes aparecerão aqui.</p>
        <a href="/reservas">Ver reservas</a>
      </div>`);
    const menu = document.querySelector('[data-notification-menu]');
    notificationButton.setAttribute('aria-controls', menu.id);
    notificationButton.addEventListener('click', event => {
      event.stopPropagation();
      toggleMenu(notificationButton, menu);
    });
  }

  const user = document.querySelector('.dashboard-header .user');
  if (user && !user.dataset.userMenuTrigger) {
    user.dataset.userMenuTrigger = 'true';
    user.dataset.userMenu = 'trigger';
    user.setAttribute('role', 'button');
    user.setAttribute('tabindex', '0');
    user.setAttribute('aria-expanded', 'false');
    user.insertAdjacentHTML('afterend', `
      <div class="user-menu" id="user-menu" data-user-menu hidden>
        <a href="/configuracoes">${icon('settings')} Configurações</a>
        <a href="/">${icon('external')} Voltar ao site</a>
        <a href="#" data-user-logout>${icon('logout')} Sair da conta</a>
      </div>`);
    const menu = document.querySelector('[data-user-menu]');
    user.setAttribute('aria-controls', menu.id);
    const open = event => {
      event.stopPropagation();
      toggleMenu(user, menu);
    };
    user.addEventListener('click', open);
    user.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') open(event);
    });
  }

  if (!document.body.dataset.chromeCloseReady) {
    document.body.dataset.chromeCloseReady = 'true';
    document.addEventListener('click', () => closeFloatingMenus());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeFloatingMenus();
    });
    document.addEventListener('click', async event => {
      const logout = event.target.closest('[data-user-logout]');
      if (!logout) return;
      requestLogout(event);
    });
  }
}
