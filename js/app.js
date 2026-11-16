import { hasLevel, getLevel, setLevel, setSession } from './core/nav.js';
import { mount as mountVocab } from './modules/vocab/picker.js';
import { mount as mountToday } from './screens/today.js';
import { mount as mountLearn } from './screens/learn.js';
import { mount as mountExam } from './screens/exam.js';
import { mount as mountProgress } from './screens/progress.js';
import { mount as mountMe } from './screens/me.js';

const LEVELS = [
  { id: 'N5', name: 'Trình độ N5', sub: 'Sơ cấp 1 • Bài 1 – 25', accent: 'accent-teal' },
  { id: 'N4', name: 'Trình độ N4', sub: 'Sơ cấp 2 • Bài 26 – 50', accent: 'accent-yellow' },
  { id: 'N3', name: 'Trình độ N3', sub: 'Trung cấp nền tảng', accent: 'accent-coral' },
  { id: 'N2', name: 'Trình độ N2', sub: 'Trung – Thượng cấp', accent: 'accent-teal' },
  { id: 'N1', name: 'Trình độ N1', sub: 'Thượng cấp', accent: 'accent-yellow' }
];

const appEl = document.getElementById('app');
let curriculumCache = null;

async function getLevelCounts() {
  if (curriculumCache) return curriculumCache;
  const counts = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
  try {
    const res = await fetch('data/curriculum.json');
    if (res.ok) {
      const levels = (await res.json())?.levels || [];
      levels.forEach((item) => {
        const lv = String(item.id || item.level || '').toUpperCase();
        if (!(lv in counts)) return;
        let total = 0;
        Object.values(item?.skills || {}).forEach((sk) => {
          const ls = sk?.lessons;
          total += Array.isArray(ls) ? ls.length : (Number(ls ?? sk?.count) || 0);
        });
        counts[lv] = total;
      });
    }
  } catch {}
  curriculumCache = counts;
  return counts;
}

function setActiveTab(tabKey) {
  document.querySelectorAll('#bottom-nav .nav-tab').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === tabKey);
  });
}

function navigateTo(hash) {
  if (window.location.hash === hash) router();
  else window.location.hash = hash;
}

async function renderFirstLevelPick() {
  document.body.dataset.onboard = '1';
  const counts = await getLevelCounts();
  const cardsHtml = LEVELS.map((lv) => {
    const n = counts[lv.id] || 0;
    return n > 0
      ? `<button type="button" class="card module-card is-active" data-pick-lv="${lv.id}">
          <div class="module-left">
            <div class="module-icon ${lv.accent} lv-pick-ico">${lv.id}</div>
            <div><div class="module-title">${lv.name}</div><div class="module-sub">${lv.sub} • ${n} bài</div></div>
          </div>
          <span class="badge badge-ready">Chọn →</span>
        </button>`
      : `<div class="card module-card is-disabled" aria-disabled="true">
          <div class="module-left">
            <div class="module-icon ${lv.accent} lv-pick-ico">${lv.id}</div>
            <div><div class="module-title">${lv.name}</div><div class="module-sub">${lv.sub}</div></div>
          </div>
          <span class="badge">Sắp có</span>
        </div>`;
  }).join('');

  appEl.innerHTML = `
    <h1 class="page-title">Chọn cấp độ</h1>
    <p class="home-intro">Chọn trình độ JLPT bạn muốn bắt đầu:</p>
    <section class="module-grid">${cardsHtml}</section>
  `;

  appEl.querySelectorAll('[data-pick-lv]').forEach((btn) => {
    btn.onclick = () => {
      setLevel(btn.dataset.pickLv);
      document.body.dataset.onboard = '';
      navigateTo('#/learn');
    };
  });
}

async function router() {
  setSession(false);
  const rawHash = window.location.hash || '#/';
  const [pathPart, queryPart = ''] = rawHash.split('?');
  const params = new URLSearchParams(queryPart);

  if (pathPart === '#/vocab' || pathPart.startsWith('#/vocab/')) {
    const legacyLv = (params.get('level') || getLevel()).toUpperCase();
    params.delete('level');
    const qs = params.toString();
    navigateTo(`#/${legacyLv.toLowerCase()}/vocab${qs ? `?${qs}` : ''}`);
    return;
  }

  const skillMatch = pathPart.match(/^#\/(n[1-5])\/([a-z0-9_-]+)$/i);
  if (skillMatch) {
    document.body.dataset.onboard = '';
    const level = setLevel(skillMatch[1].toUpperCase());
    const skill = skillMatch[2].toLowerCase();
    setActiveTab('learn');
    if (skill === 'vocab') {
      mountVocab(appEl, { level, query: params });
      return;
    }
    navigateTo('#/learn');
    return;
  }

  if (!hasLevel()) {
    await renderFirstLevelPick();
    return;
  }

  document.body.dataset.onboard = '';
  const chip = document.getElementById('level-chip-label');
  if (chip) chip.textContent = getLevel();

  if (pathPart === '#/learn') { setActiveTab('learn'); await mountLearn(appEl); return; }
  if (pathPart === '#/exam') { setActiveTab('exam'); mountExam(appEl); return; }
  if (pathPart === '#/progress') { setActiveTab('progress'); await mountProgress(appEl); return; }
  if (pathPart === '#/me') { setActiveTab('me'); mountMe(appEl); return; }

  setActiveTab('today');
  mountToday(appEl);
}

function initLevelSheet() {
  const modal = document.getElementById('level-modal');
  const listEl = document.getElementById('level-list');
  const openBtn = document.getElementById('btn-level-chip');
  const closeBtn = document.getElementById('btn-close-level');

  if (hasLevel()) {
    const chip = document.getElementById('level-chip-label');
    if (chip) chip.textContent = getLevel();
  }

  openBtn.onclick = async () => {
    const counts = await getLevelCounts();
    const cur = getLevel();
    listEl.innerHTML = LEVELS.map((lv) => {
      const hasData = (counts[lv.id] || 0) > 0;
      const isCur = lv.id === cur;
      return `
        <button type="button" class="level-opt ${hasData ? '' : 'is-disabled'} ${isCur ? 'is-current' : ''}" data-lv="${lv.id}" ${hasData ? '' : 'disabled'}>
          <div class="module-left">
            <div class="module-icon ${lv.accent} lv-sheet-ico">${lv.id}</div>
            <div>
              <div class="module-title lv-sheet-title">${lv.name}</div>
              <div class="module-sub">${lv.sub}</div>
            </div>
          </div>
          <span class="badge ${hasData ? (isCur ? 'badge-ready' : '') : ''}">${hasData ? (isCur ? 'Đang chọn' : `${counts[lv.id]} bài`) : 'Sắp có'}</span>
        </button>`;
    }).join('');

    listEl.querySelectorAll('.level-opt:not([disabled])').forEach((btn) => {
      btn.onclick = () => {
        const nextLv = setLevel(btn.dataset.lv);
        modal.close();
        const [pathPart, queryPart = ''] = (window.location.hash || '#/').split('?');
        const m = pathPart.match(/^#\/(n[1-5])\/([a-z0-9_-]+)$/i);
        if (m) navigateTo(`#/${nextLv.toLowerCase()}/${m[2].toLowerCase()}${queryPart ? `?${queryPart}` : ''}`);
        else router();
      };
    });

    modal.showModal();
  };

  closeBtn.onclick = () => modal.close();
  modal.onclick = (e) => { if (e.target === modal) modal.close(); };
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  initLevelSheet();
  router();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
});
(() => {
  const nav = document.getElementById('bottom-nav') || document.querySelector('.bottom-nav');
  if (!nav || nav.querySelector('.sidebar-head')) return;

  if (localStorage.getItem('manabi:navCollapsed') === '1') {
    document.body.classList.add('nav-collapsed');
  }

  const head = document.createElement('div');
  head.className = 'sidebar-head';
  head.innerHTML = `
    <span class="sidebar-brand">MENU</span>
    <button type="button" id="nav-collapse-btn" class="btn btn-icon nav-collapse-btn" title="Thu gọn / Mở rộng menu">☰</button>
  `;
  nav.prepend(head);

  // Add hover tooltips when collapsed
  nav.querySelectorAll('.nav-tab').forEach((tab) => {
    const label = tab.querySelector('.nav-lbl')?.textContent?.trim();
    if (label && !tab.title) tab.title = label;
  });

  head.querySelector('#nav-collapse-btn').onclick = () => {
    const collapsed = document.body.classList.toggle('nav-collapsed');
    localStorage.setItem('manabi:navCollapsed', collapsed ? '1' : '0');
  };
})();