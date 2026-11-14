import { exportBackup, importBackup } from './core/store.js';

const MODULES = [
  {
    id: 'vocab',
    name: 'Từ vựng',
    sub: 'Flashcard, Ghép thẻ, Trắc nghiệm, Phản xạ',
    icon: '語',
    accent: 'accent-teal',
    ready: true
  },
  {
    id: 'kanji',
    name: 'Kanji',
    sub: 'Hán tự, Âm đọc & Bộ thủ',
    icon: '字',
    accent: 'accent-yellow',
    ready: false
  },
  {
    id: 'grammar',
    name: 'Ngữ pháp',
    sub: 'Mẫu câu, Cách chia & Ví dụ',
    icon: '文',
    accent: 'accent-coral',
    ready: false
  }
];

const appEl = document.getElementById('app');

function renderHome() {
  const cardsHtml = MODULES.map((m) => {
    if (m.ready) {
      return `
        <a href="#/${m.id}" class="card module-card is-active">
          <div class="module-left">
            <div class="module-icon ${m.accent}">${m.icon}</div>
            <div>
              <div class="module-title">${m.name}</div>
              <div class="module-sub">${m.sub}</div>
            </div>
          </div>
          <span class="badge badge-ready">Vào học →</span>
        </a>
      `;
    }
    return `
      <div class="card module-card is-disabled" aria-disabled="true">
        <div class="module-left">
          <div class="module-icon ${m.accent}">${m.icon}</div>
          <div>
            <div class="module-title">${m.name}</div>
            <div class="module-sub">${m.sub}</div>
          </div>
        </div>
        <span class="badge">Sắp có</span>
      </div>
    `;
  }).join('');

  appEl.innerHTML = `
    <p class="home-intro">Chọn học phần để bắt đầu luyện tập hôm nay:</p>
    <section class="module-grid">${cardsHtml}</section>
  `;
}

function renderVocabPlaceholder() {
  appEl.innerHTML = `
    <section class="card placeholder-box">
      <h1 class="module-title">Module Từ vựng — đang xây</h1>
      <p class="module-sub">Các chế độ chọn bài, Flashcard, Match, Quiz và Reflex sẽ được gắn vào đây ở phase tiếp theo.</p>
      <a href="#/" class="btn btn-teal">← Về trang chủ</a>
    </section>
  `;
}

function router() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/vocab')) {
    renderVocabPlaceholder();
  } else {
    renderHome();
  }
}

function initBackupModal() {
  const modal = document.getElementById('backup-modal');
  const btnOpen = document.getElementById('btn-backup');
  const btnClose = document.getElementById('btn-close-modal');
  const btnExport = document.getElementById('btn-export');
  const inputImport = document.getElementById('input-import');
  const msgEl = document.getElementById('backup-msg');

  const showMsg = (text, isError = false) => {
    msgEl.hidden = false;
    msgEl.style.color = isError ? 'var(--red)' : 'var(--green)';
    msgEl.textContent = text;
  };

  btnOpen.addEventListener('click', () => {
    msgEl.hidden = true;
    modal.showModal();
  });

  btnClose.addEventListener('click', () => modal.close());

  btnExport.addEventListener('click', () => {
    exportBackup();
    showMsg('Đã tải file sao lưu về máy!');
  });

  inputImport.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      showMsg('Khôi phục dữ liệu thành công!');
      router();
    } catch (err) {
      showMsg(err.message || 'File không hợp lệ', true);
    } finally {
      inputImport.value = '';
    }
  });
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  initBackupModal();
  router();
});