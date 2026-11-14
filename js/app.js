import { getStore, exportBackup, importBackup } from './core/store.js';
import { mount as mountVocab, meta as vocabMeta } from './modules/vocab/picker.js';

const MODULES = [
  { ...vocabMeta, sub: 'Flashcard, Ghép thẻ, Trắc nghiệm, Phản xạ', accent: 'accent-teal', ready: true },
  { id: 'kanji', name: 'Kanji', sub: 'Hán tự, Âm đọc & Bộ thủ', icon: '字', accent: 'accent-yellow', ready: false },
  { id: 'grammar', name: 'Ngữ pháp', sub: 'Mẫu câu, Cách chia & Ví dụ', icon: '文', accent: 'accent-coral', ready: false }
];

const appEl = document.getElementById('app');

function renderHome() {
  const cardsHtml = MODULES.map((m) => m.ready
    ? `<a href="#/${m.id}" class="card module-card is-active">
        <div class="module-left">
          <div class="module-icon ${m.accent}">${m.icon}</div>
          <div><div class="module-title">${m.name}</div><div class="module-sub">${m.sub}</div></div>
        </div>
        <span class="badge badge-ready">Vào học →</span>
      </a>`
    : `<div class="card module-card is-disabled" aria-disabled="true">
        <div class="module-left">
          <div class="module-icon ${m.accent}">${m.icon}</div>
          <div><div class="module-title">${m.name}</div><div class="module-sub">${m.sub}</div></div>
        </div>
        <span class="badge">Sắp có</span>
      </div>`
  ).join('');

  appEl.innerHTML = `<p class="home-intro">Chọn học phần để bắt đầu luyện tập hôm nay:</p><section class="module-grid">${cardsHtml}</section>`;
}

function router() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/vocab')) mountVocab(appEl);
  else renderHome();
}

function initModals() {
  const bModal = document.getElementById('backup-modal');
  const msgEl = document.getElementById('backup-msg');
  const showMsg = (text, isErr = false) => {
    msgEl.hidden = false;
    msgEl.style.color = isErr ? 'var(--red)' : 'var(--green)';
    msgEl.textContent = text;
  };

  document.getElementById('btn-backup').onclick = () => { msgEl.hidden = true; bModal.showModal(); };
  document.getElementById('btn-close-modal').onclick = () => bModal.close();
  document.getElementById('btn-export').onclick = () => { exportBackup(); showMsg('Đã tải file sao lưu về máy!'); };
  document.getElementById('input-import').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await importBackup(file); showMsg('Khôi phục dữ liệu thành công!'); router(); }
    catch (err) { showMsg(err.message || 'File không hợp lệ', true); }
    finally { e.target.value = ''; }
  };

  const mModal = document.getElementById('menu-modal');
  const mList = document.getElementById('menu-list');
  document.getElementById('btn-menu').onclick = () => {
    const st = getStore('vocab', { weakWords: [], openWords: [], customLessons: [] });
    const weakCount = (st.weakWords || []).length;
    const openCount = (st.openWords || []).length;
    const customCount = (st.customLessons || []).length;

    mList.innerHTML = `
      <button type="button" class="btn btn-coral" data-go="weak" style="justify-content:space-between;">
        <span>📌 Từ đã sai / Đã lưu</span><span class="badge">${weakCount} từ</span>
      </button>
      <button type="button" class="btn btn-teal" data-go="open" style="justify-content:space-between;">
        <span>📖 Bài mở (từ ngoài sách)</span><span class="badge">${openCount} từ</span>
      </button>
      <button type="button" class="btn btn-yellow" data-go="manage" style="justify-content:space-between;">
        <span>🗂 Quản lý bài & Thêm từ</span><span class="badge">${customCount} bài</span>
      </button>
    `;
    mList.querySelectorAll('[data-go]').forEach((btn) => {
      btn.onclick = () => {
        mModal.close();
        window.location.hash = `#/vocab?view=${btn.dataset.go}`;
        mountVocab(appEl);
      };
    });
    mModal.showModal();
  };
  document.getElementById('btn-close-menu').onclick = () => mModal.close();
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => { initModals(); router(); });