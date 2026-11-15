import { getLevel } from '../core/nav.js';

const EXAM_MODES = [
  { title: 'Mini test', desc: 'Kiểm tra nhanh 15 phút theo từng phần kiến thức', icon: '⏱️', accent: 'accent-teal' },
  { title: 'Thi thử đầy đủ', desc: 'Đề thi mô phỏng cấu trúc và thời gian chuẩn JLPT', icon: '📄', accent: 'accent-yellow' },
  { title: 'Theo dạng bài', desc: 'Luyện chuyên sâu từng mondai từ vựng, ngữ pháp, đọc hiểu', icon: '🎯', accent: 'accent-coral' }
];

export function mount(container) {
  const lv = getLevel();
  const cardsHtml = EXAM_MODES.map((m) => `
    <div class="card module-card is-disabled" aria-disabled="true">
      <div class="module-left">
        <div class="module-icon ${m.accent}">${m.icon}</div>
        <div>
          <div class="module-title">${m.title}</div>
          <div class="module-sub">${m.desc}</div>
        </div>
      </div>
      <span class="badge">Sắp có</span>
    </div>
  `).join('');

  container.innerHTML = `
    <h1 class="page-title">Đề thi ${lv}</h1>
    <section class="module-grid">${cardsHtml}</section>
  `;
}