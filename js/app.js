import { getStore, exportBackup, importBackup } from './core/store.js';
import { mount as mountVocab } from './modules/vocab/picker.js';

const LEVELS = [
  { id: 'N5', name: 'Trình độ N5', sub: 'Sơ cấp 1 • Bài 1 – 25', icon: 'N5', accent: 'accent-teal' },
  { id: 'N4', name: 'Trình độ N4', sub: 'Sơ cấp 2 • Bài 26 – 50', icon: 'N4', accent: 'accent-yellow' },
  { id: 'N3', name: 'Trình độ N3', sub: 'Trung cấp nền tảng', icon: 'N3', accent: 'accent-coral' },
  { id: 'N2', name: 'Trình độ N2', sub: 'Trung – Thượng cấp', icon: 'N2', accent: 'accent-teal' },
  { id: 'N1', name: 'Trình độ N1', sub: 'Thượng cấp', icon: 'N1', accent: 'accent-yellow' }
];

const appEl = document.getElementById('app');
let levelCountsCache = null;

async function getLevelCounts() {
  if (levelCountsCache) return levelCountsCache;
  const counts = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
  try {
    const res = await fetch('data/vocab/index.json');
    if (res.ok) {
      const lessons = (await res.json())?.lessons || [];
      lessons.forEach((l) => {
        const lv = String(l.level || (l.file?.split('/')[0]) || '').toUpperCase();
        if (lv in counts) counts[lv]++;
      });
    }
  } catch {}
  levelCountsCache = counts;
  return counts;
}

async function renderHome() {
  const counts = await getLevelCounts();
  const cardsHtml = LEVELS.map((lv) => {
    const n = counts[lv.id] || 0;
    return n > 0
      ? `<a href="#/vocab?level=${lv.id}" class="card module-card is-active">
          <div class="module-left">
            <div class="module-icon ${lv.accent}" style="font-family:var(--font-ui);font-size:1.25rem;font-weight:800;">${lv.icon}</div>
            <div><div class="module-title">${lv.name}</div><div class="module-sub">${lv.sub} • ${n} bài</div></div>
          </div>
          <span class="badge badge-ready">Vào học →</span>
        </a>`
      : `<div class="card module-card is-disabled" aria-disabled="true">
          <div class="module-left">
            <div class="module-icon ${lv.accent}" style="font-family:var(--font-ui);font-size:1.25rem;font-weight:800;">${lv.icon}</div>
            <div><div class="module-title">${lv.name}</div><div class="module-sub">${lv.sub}</div></div>
          </div>
          <span class="badge">Sắp có</span>
        </div>`;
  }).join('');

  appEl.innerHTML = `<p class="home-intro">Chọn cấp độ JLPT để bắt đầu luyện tập:</p><section class="module-grid">${cardsHtml}</section>`;
}

function router() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/vocab')) mountVocab(appEl);
  else renderHome();
}

function navigateTo(hash) {
  history.replaceState(null, '', hash);
  router();
}

function initMenu() {
  const modal = document.getElementById('menu-modal');
  const body = document.getElementById('menu-body');
  const secLabel = (t) => `<div style="font-size:0.78rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;">${t}</div>`;

  const renderMenuContent = () => {
    const st = getStore('vocab', { weakWords: [], openWords: [], customLessons: [] });
    const weakCount = (st.weakWords || []).length;
    const openCount = (st.openWords || []).length;
    const customCount = (st.customLessons || []).length;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${secLabel('Điều hướng')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" class="btn" data-nav="#/">🏠 Trang chủ</button>
          <button type="button" class="btn btn-teal" data-nav="#/vocab?level=N4">語 Từ vựng N4</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1.5px dashed var(--border);">
        ${secLabel('Ôn tập cá nhân')}

        <div style="padding:10px 12px;border-radius:14px;background:var(--bg-elevated);border:1.5px solid var(--border);display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-weight:800;font-size:0.98rem;">📌 Từ cần ôn lại</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">Tự lưu khi làm sai hoặc đánh dấu</div>
            </div>
            <span class="badge">${weakCount} từ</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button type="button" class="btn btn-coral" data-nav="#/vocab?view=study-weak" ${weakCount === 0 ? 'disabled' : ''} style="font-size:0.9rem;">▶ Ôn ngay</button>
            <button type="button" class="btn" data-nav="#/vocab?view=weak" style="font-size:0.9rem;">Xem / Xóa</button>
          </div>
        </div>

        <div style="padding:10px 12px;border-radius:14px;background:var(--bg-elevated);border:1.5px solid var(--border);display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-weight:800;font-size:0.98rem;">📖 Từ mở rộng</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">Từ vựng thêm ngoài giáo trình</div>
            </div>
            <span class="badge">${openCount} từ</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button type="button" class="btn btn-teal" data-nav="#/vocab?view=study-open" ${openCount === 0 ? 'disabled' : ''} style="font-size:0.9rem;">▶ Học ngay</button>
            <button type="button" class="btn" data-nav="#/vocab?view=open" style="font-size:0.9rem;">Xem / Sửa</button>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1.5px dashed var(--border);">
        ${secLabel('Kho từ & Sao lưu')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" class="btn btn-yellow" data-nav="#/vocab?view=add" style="font-size:0.92rem;">＋ Thêm từ</button>
          <button type="button" class="btn" data-nav="#/vocab?view=manage" style="font-size:0.92rem;">🗂 Kho từ (${customCount})</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" id="btn-export" class="btn" style="font-size:0.92rem;">⬇ Xuất backup</button>
          <label class="btn" style="font-size:0.92rem;">
            ⬆ Nhập backup
            <input type="file" id="input-import" accept="application/json" hidden>
          </label>
        </div>
        <p id="backup-msg" class="backup-msg" hidden></p>
      </div>
    `;

    body.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.onclick = () => { modal.close(); navigateTo(btn.dataset.nav); };
    });

    const msgEl = body.querySelector('#backup-msg');
    const showMsg = (text, isErr = false) => {
      msgEl.hidden = false;
      msgEl.style.color = isErr ? 'var(--red)' : 'var(--green)';
      msgEl.textContent = text;
    };

    body.querySelector('#btn-export').onclick = () => { exportBackup(); showMsg('Đã tải file sao lưu về máy!'); };
    body.querySelector('#input-import').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try { await importBackup(file); renderMenuContent(); showMsg('Khôi phục dữ liệu thành công!'); router(); }
      catch (err) { showMsg(err.message || 'File không hợp lệ', true); }
    };
  };

  document.getElementById('btn-menu').onclick = () => { renderMenuContent(); modal.showModal(); };
  document.getElementById('btn-close-menu').onclick = () => modal.close();
  modal.onclick = (e) => { if (e.target === modal) modal.close(); };
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  initMenu();
  router();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});