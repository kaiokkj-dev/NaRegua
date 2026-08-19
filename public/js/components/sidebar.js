import { icon, polishDashboardIcons } from './icons.js';
const items = [
  ['dashboard', 'Dashboard', '/dashboard'], ['calendar', 'Agenda', '/agenda'], ['clients', 'Clientes', '/clientes'],
  ['scissors', 'Serviços', '/servicos'], ['professional', 'Profissionais', '/profissionais'], ['coupon', 'Cupons', '/cupons'], ['settings', 'Configurações', '/configuracoes']
];
const helpUrl = 'https://wa.me/5511994495536?text=Oi%2C%20preciso%20de%20ajuda%20com%20o%20NaR%C3%A9gua.';

export function renderSidebar(target) {
  target.innerHTML = `
    <div class="sidebar-brand"><a class="brand brand-light" href="/"><img src="/assets/images/logo-icon.png" alt=""><span>Na<strong>Régua</strong></span></a><button data-sidebar-close>${icon('close')}</button></div>
    <button class="shop-card" type="button" data-shop-menu-trigger aria-expanded="false"><span>BR</span><div><strong>Barbearia do Rafa</strong><small>Plano profissional</small></div><b>${icon('chevron')}</b></button>
    <div class="shop-menu" data-shop-menu hidden>
      <a href="/configuracoes">${icon('settings')} Ajustes da barbearia</a>
      <a href="/cupons">${icon('coupon')} Cupons e descontos</a>
      <a href="/agenda">${icon('calendar')} Ver agenda</a>
    </div>
    <small class="nav-label">MENU PRINCIPAL</small>
    <nav class="sidebar-nav">${items.slice(0, 6).map(([iconName, label, href]) => `<a class="${location.pathname === href ? 'active' : ''}" href="${href}"><i>${icon(iconName)}</i>${label}</a>`).join('')}</nav>
    <small class="nav-label">PREFERÊNCIAS</small>
    <nav class="sidebar-nav">${items.slice(6).map(([iconName, label, href]) => `<a href="${href}"><i>${icon(iconName)}</i>${label}</a>`).join('')}<a href="/"><i>${icon('external')}</i>Voltar ao site</a><a href="#" data-logout><i>${icon('logout')}</i>Sair</a></nav>
    <a class="sidebar-help" href="${helpUrl}" target="_blank" rel="noopener"><span>?</span><div><strong>Precisa de ajuda?</strong><small>Fale conosco no WhatsApp</small></div><b>→</b></a>`;

  polishDashboardIcons(document);
  initDashboardChrome();
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
}

function toggleMenu(trigger, menu) {
  const willOpen = menu.hidden;
  closeFloatingMenus(menu);
  menu.hidden = !willOpen;
  trigger.setAttribute('aria-expanded', String(willOpen));
}

function initDashboardChrome() {
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

  const notificationButton = document.querySelector('.header-actions > button');
  if (notificationButton && !notificationButton.dataset.notificationTrigger) {
    notificationButton.dataset.notificationTrigger = 'true';
    notificationButton.type = 'button';
    notificationButton.setAttribute('aria-expanded', 'false');
    notificationButton.insertAdjacentHTML('afterend', `
      <div class="notification-menu" id="notification-menu" data-notification-menu hidden>
        <small>CENTRAL</small>
        <strong>Nenhuma urgência agora</strong>
        <p>Reservas pendentes e avisos importantes aparecem aqui.</p>
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
