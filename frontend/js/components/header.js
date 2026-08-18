export function renderHeader(target) {
  target.innerHTML = `
    <div class="container header-inner">
      <a class="brand brand-light" href="/" aria-label="NaRégua - início"><img src="/assets/images/logo-icon.png" alt=""><span>Na<strong>Régua</strong></span></a>
      <nav id="main-nav"><a href="#funcionalidades">Funcionalidades</a><a href="#como-funciona">Como funciona</a><a href="#precos">Preços</a></nav>
      <div class="header-cta"><a href="/dashboard">Entrar</a><a class="button button-primary" href="/dashboard">Começar grátis</a></div>
      <button class="menu-toggle" aria-label="Alternar menu" aria-expanded="false">☰</button>
    </div>`;
  const toggle = target.querySelector('.menu-toggle');
  const nav = target.querySelector('#main-nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => nav.classList.remove('open')));
}
