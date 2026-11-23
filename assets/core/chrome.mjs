export const TOOL_LINKS = [
  ['split', 'hub.split'], ['merge', 'hub.merge'], ['interleave', 'hub.interleave'],
  ['images-to-pdf', 'hub.images'], ['organize', 'hub.organize'],
  ['nup', 'hub.nup'], ['margin', 'hub.margin'],
];

const paths = {
  brand: '<path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8.5 12l2.5 2.5 4.5-5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  warning: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  margin: '<path d="M5 2h14v20H5zM8 6h8M8 9h8M8 12h8M5 16h14M8 19h3"/>',
  nup: '<rect x="3" y="2" width="18" height="20" rx="2"/><path d="M12 2v20M3 12h18M7 6v2m10-2v2M7 16v2m10-2v2"/>',
  organize: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m14 21 1-4 5-5 3 3-5 5z"/>',
};

export const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.brand}</svg>`;

export function mountChrome() {
  if (document.querySelector('[data-app-chrome]')) return;
  // 舊頁也經 initI18n() 載入共用頂欄；保留原有標題，避免要逐頁改 HTML。
  const legacy = document.querySelector('header.site');
  if (legacy) {
    const heading = legacy.querySelector('h1');
    legacy.replaceChildren(...(heading ? [heading] : []));
  }
  const base = new URL('../../', import.meta.url);
  const header = document.createElement('header');
  header.className = 'topbar';
  header.dataset.appChrome = '';
  header.innerHTML = `<a class="brand" href="${new URL('index.html', base)}">
    <span class="brand-mark">${icon('brand')}</span><span data-i18n="app.title"></span></a>
    <div class="top-actions"><span class="local-badge">${icon('shield')}<span data-i18n="chrome.localBadge"></span></span>
    <details class="tool-menu"><summary><span data-i18n="chrome.tools"></span>${icon('chevron')}</summary>
      <nav class="menu-pop" data-i18n-label="chrome.tools">
        <a href="${new URL('index.html', base)}" data-i18n="chrome.home"></a>
        ${TOOL_LINKS.map(([slug, key]) => `<a href="${new URL(`tools/${slug}.html`, base)}" data-i18n="${key}"></a>`).join('')}
      </nav></details>
    <button type="button" id="lang-toggle" class="language" data-i18n="app.langToggle"></button></div>`;
  header.querySelectorAll('.menu-pop a').forEach(a => {
    if (new URL(a.href).pathname === location.pathname) a.setAttribute('aria-current', 'page');
  });
  const menu = header.querySelector('details');
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.open = false; });
  header.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `<span data-i18n="chrome.forTeachers"></span><span class="local-badge">${icon('shield')}<span data-i18n="chrome.localOnly"></span></span>`;
  document.body.append(footer);
}
