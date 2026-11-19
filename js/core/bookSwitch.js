import { getStore, updateStore } from './store.js';

export const getBookSource = () => {
  const s = getStore('settings', {});
  return s?.bookSource === 'riki' ? 'riki' : 'somatome';
};

export const setBookSource = (src) => {
  updateStore('settings', (cur) => ({ ...(cur || {}), bookSource: src === 'riki' ? 'riki' : 'somatome' }), {});
};

export function renderBookDropdown(id = 'book-src-dd') {
  const isSm = getBookSource() === 'somatome';
  return `
    <div id="${id}" style="position:relative;display:inline-block;">
      <button type="button" class="btn btn-sm ${isSm ? 'btn-yellow' : 'btn-teal'}" data-dd-btn aria-expanded="false" style="gap:6px;">
        <span>${isSm ? '📒 Sou-matome' : '📚 Riki'}</span>
        <span style="font-size:.75rem;opacity:.85;">▾</span>
      </button>
      <div class="card" data-dd-menu style="display:none;flex-direction:column;gap:6px;position:absolute;right:0;top:calc(100% + 6px);min-width:180px;padding:8px;z-index:50;box-shadow:0 12px 28px rgba(0,0,0,.55);">
        <button type="button" class="btn btn-sm ${isSm ? 'btn-yellow' : ''}" data-dd-val="somatome" style="justify-content:flex-start;width:100%;">📒 Sou-matome</button>
        <button type="button" class="btn btn-sm ${!isSm ? 'btn-teal' : ''}" data-dd-val="riki" style="justify-content:flex-start;width:100%;">📚 Giáo trình Riki</button>
      </div>
    </div>`;
}

export function bindBookDropdown(container, onChange, id = 'book-src-dd') {
  const root = container.querySelector(`#${id}`);
  if (!root) return;
  const btn = root.querySelector('[data-dd-btn]');
  const menu = root.querySelector('[data-dd-menu]');

  const closeMenu = () => {
    menu.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.onclick = (e) => {
    e.stopPropagation();
    const isClosed = menu.style.display === 'none';
    menu.style.display = isClosed ? 'flex' : 'none';
    btn.setAttribute('aria-expanded', String(isClosed));
  };

  root.querySelectorAll('[data-dd-val]').forEach((item) => {
    item.onclick = (e) => {
      e.stopPropagation();
      const val = item.dataset.ddVal;
      closeMenu();
      if (val !== getBookSource()) {
        setBookSource(val);
        onChange?.(val);
      }
    };
  });

  const onDocClick = (e) => {
    if (!document.body.contains(root)) {
      document.removeEventListener('click', onDocClick);
      return;
    }
    if (!root.contains(e.target)) closeMenu();
  };
  document.addEventListener('click', onDocClick);
}