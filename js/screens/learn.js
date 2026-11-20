import { getLevel } from '../core/nav.js';
import { getStore } from '../core/store.js';
import { getBookSource, renderBookDropdown, bindBookDropdown } from '../core/bookSwitch.js';

const SKILLS = [
  { id: 'vocab', name: 'Từ vựng', icon: '語', accent: 'accent-teal', smRange: 'Tuần 4–6', smWeeks: [4, 5, 6] },
  { id: 'kanji', name: 'Kanji', icon: '漢', accent: 'accent-yellow', smRange: 'Tuần 1–3', smWeeks: [1, 2, 3] },
  { id: 'grammar', name: 'Ngữ pháp', icon: '文', accent: 'accent-coral', smRange: 'Tuần 1–4', smWeeks: [1, 2, 3, 4] },
  { id: 'reading', name: 'Đọc hiểu', icon: '読', accent: 'accent-teal', smRange: 'Tuần 5', smWeeks: [5] },
  { id: 'listening', name: 'Nghe hiểu', icon: '聴', accent: 'accent-yellow', smRange: 'Tuần 6', smWeeks: [6] }
];

function countSomatomeLoaded(skill, weeks, rikiCount) {
  if (skill === 'grammar') return rikiCount;
  const storeKey = skill === 'kanji' ? 'kanji' : 'vocab';
  const custom = getStore(storeKey, { customLessons: [] })?.customLessons || [];
  const days = new Set();
  custom.forEach((cl) => {
    const m = String(cl.name || '').match(/Tuần\s*([1-6])\s*[-–—]\s*Ngày\s*([1-6])/i);
    if (m && weeks.includes(Number(m[1]))) days.add(`${m[1]}-${m[2]}`);
  });
  return days.size;
}

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

  function render() {
    const isSomatome = getBookSource() === 'somatome';

    const cardsHtml = SKILLS.map((sk) => {
      const data = levelSkills[sk.id];
      const ls = data?.lessons;
      const rikiCount = Array.isArray(ls) ? ls.length : (Number(ls ?? data?.count) || 0);
      const active = Boolean(data) && rikiCount > 0;

      let subText = 'Đang cập nhật';
      if (active) {
        if (isSomatome) {
          const totalDays = sk.id === 'grammar' ? sk.smWeeks.length * 7 : sk.smWeeks.length * 6;
          const loadedDays = countSomatomeLoaded(sk.id, sk.smWeeks, rikiCount);
          subText = `${sk.smRange} • Đã nạp ${loadedDays}/${totalDays} ${sk.id === 'grammar' ? 'bài' : 'ngày'}`;
        } else {
          subText = `${rikiCount} bài`;
        }
      }

      return active
        ? `<a href="#/${lvLower}/${sk.id}" class="card module-card is-active">
            <div class="module-left">
              <div class="module-icon ${sk.accent}">${sk.icon}</div>
              <div>
                <div class="module-title">${sk.name}</div>
                <div class="module-sub">${subText}</div>
              </div>
            </div>
            <span class="badge badge-ready">Vào học →</span>
          </a>`
        : `<div class="card module-card is-disabled" aria-disabled="true">
            <div class="module-left">
              <div class="module-icon ${sk.accent}">${sk.icon}</div>
              <div>
                <div class="module-title">${sk.name}</div>
                <div class="module-sub">${isSomatome ? `${sk.smRange} • Sắp có` : 'Đang cập nhật'}</div>
              </div>
            </div>
            <span class="badge">Sắp có</span>
          </div>`;
    }).join('');

    container.innerHTML = `
      <div class="row-between mb-12">
        <h1 class="page-title" style="margin:0;">Luyện tập ${lv}</h1>
        ${renderBookDropdown('lrn-book-dd')}
      </div>
      <section class="module-grid">${cardsHtml}</section>
    `;

    bindBookDropdown(container, () => render(), 'lrn-book-dd');
  }

  render();
}