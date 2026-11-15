import { getLevel } from '../core/nav.js';

const SKILLS = [
  { id: 'vocab', name: 'Từ vựng', icon: '語', accent: 'accent-teal' },
  { id: 'kanji', name: 'Kanji', icon: '漢', accent: 'accent-yellow' },
  { id: 'grammar', name: 'Ngữ pháp', icon: '文', accent: 'accent-coral' },
  { id: 'reading', name: 'Đọc hiểu', icon: '読', accent: 'accent-teal' },
  { id: 'listening', name: 'Nghe hiểu', icon: '聴', accent: 'accent-yellow' }
];

export async function mount(container) {
  const lv = getLevel();
  const lvLower = lv.toLowerCase();
  container.innerHTML = `<h1 class="page-title">Luyện tập ${lv}</h1><div class="card"><p class="module-sub">Đang tải chương trình học...</p></div>`;

  let levelSkills = {};
  try {
    const res = await fetch('data/curriculum.json');
    if (res.ok) {
      const levels = (await res.json())?.levels || [];
      const found = levels.find((item) => String(item.id || item.level || '').toUpperCase() === lv);
      levelSkills = found?.skills || {};
    }
  } catch {}

  const cardsHtml = SKILLS.map((sk) => {
    const data = levelSkills[sk.id];
    const ls = data?.lessons;
    const count = Array.isArray(ls) ? ls.length : (Number(ls ?? data?.count) || 0);
    const active = Boolean(data) && count > 0;

    return active
      ? `<a href="#/${lvLower}/${sk.id}" class="card module-card is-active">
          <div class="module-left">
            <div class="module-icon ${sk.accent}">${sk.icon}</div>
            <div>
              <div class="module-title">${sk.name}</div>
              <div class="module-sub">${count} bài</div>
            </div>
          </div>
          <span class="badge badge-ready">Vào học →</span>
        </a>`
      : `<div class="card module-card is-disabled" aria-disabled="true">
          <div class="module-left">
            <div class="module-icon ${sk.accent}">${sk.icon}</div>
            <div>
              <div class="module-title">${sk.name}</div>
              <div class="module-sub">Đang cập nhật</div>
            </div>
          </div>
          <span class="badge">Sắp có</span>
        </div>`;
  }).join('');

  container.innerHTML = `
    <h1 class="page-title">Luyện tập ${lv}</h1>
    <section class="module-grid">${cardsHtml}</section>
  `;
}