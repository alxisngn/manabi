import { getLevel } from '../core/nav.js';
import { getLessonProgress } from '../core/progress.js';
import { getStore } from '../core/store.js';
import { getBookSource, renderBookDropdown, bindBookDropdown } from '../core/bookSwitch.js';
import { escapeHtml } from '../core/util.js';

const CATEGORIES = [
  { id: 'kanji', label: 'Kanji', icon: '漢', ready: true, smRange: 'Tuần 1–3', smWeeks: [1, 2, 3] },
  { id: 'vocab', label: 'Từ vựng', icon: '📚', ready: true, smRange: 'Tuần 4–6', smWeeks: [4, 5, 6] },
  { id: 'grammar', label: 'Ngữ pháp', icon: '🧩', ready: false, smRange: 'Tuần 1–4', smWeeks: [1, 2, 3, 4] },
  { id: 'reading', label: 'Đọc hiểu', icon: '📖', ready: false, smRange: 'Tuần 5', smWeeks: [5] },
  { id: 'listening', label: 'Nghe hiểu', icon: '🎧', ready: false, smRange: 'Tuần 6', smWeeks: [6] }
];

const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

async function fetchSkillLessons(level, skill) {
  try {
    const res = await fetch(`data/${level.toLowerCase()}/${skill}/index.json`);
    if (!res.ok) return [];
    const list = (await res.json())?.lessons || [];
    return list.map((l) => ({ id: l.id, name: cleanName(l.name) }));
  } catch {
    return [];
  }
}

function buildSomatomeLessons(skill, smWeeks) {
  const storeKey = skill === 'kanji' ? 'kanji' : 'vocab';
  const custom = getStore(storeKey, { customLessons: [] })?.customLessons || [];
  const tagged = new Map();

  custom.forEach((cl) => {
    const m = String(cl.name || '').match(/Tuần\s*([1-6])\s*[-–—]\s*Ngày\s*([1-6])/i);
    if (m) {
      const w = Number(m[1]);
      const d = Number(m[2]);
      if (smWeeks.includes(w)) tagged.set(`${w}-${d}`, cl);
    }
  });

  const slots = [];
  smWeeks.forEach((w) => {
    for (let d = 1; d <= 6; d++) {
      const found = tagged.get(`${w}-${d}`);
      slots.push({
        id: found ? found.id : null,
        name: `Tuần ${w} - Ngày ${d}`,
        wordCount: found ? (found.words?.length || 0) : 0,
        loaded: Boolean(found)
      });
    }
  });
  return slots;
}

export async function mount(container) {
  const level = (getLevel() || 'N4').toUpperCase();
  const openState = { vocab: false, grammar: false, kanji: false, reading: false, listening: false };

  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải tiến độ...</p></div>`;
  const [vocabLessons, kanjiLessons] = await Promise.all([
    fetchSkillLessons(level, 'vocab'),
    fetchSkillLessons(level, 'kanji')
  ]);
  const rikiByCat = { vocab: vocabLessons, kanji: kanjiLessons };

  const formatDate = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('vi-VN');
  };

  function render() {
    const isSomatome = getBookSource() === 'somatome';

    const sectionsHtml = CATEGORIES.map((cat) => {
      const isOpen = Boolean(openState[cat.id]);
      let passedCount = 0;

      if (isSomatome) {
        const slots = cat.ready ? buildSomatomeLessons(cat.id, cat.smWeeks) : [];
        const total = slots.length;

        const cardsHtml = slots.map((slot) => {
          if (!slot.loaded) {
            return `
              <a href="#/${level.toLowerCase()}/${cat.id}" class="card v-row prg-lesson-link">
                <div class="col gap-4">
                  <span class="prg-lesson-name">${escapeHtml(slot.name)}</span>
                  <span class="text-sm text-muted">Chưa nạp từ vựng</span>
                </div>
                <div class="prg-lesson-side">
                  <span class="badge st-none">Chưa nạp</span>
                </div>
              </a>`;
          }

          const prog = getLessonProgress(level, cat.id, slot.id) || {};
          const passed = prog.status === 'done';
          const inProgress = !passed && prog.status === 'learning';
          const best = Number(prog.bestPct ?? prog.bestScore ?? prog.highScore ?? prog.best ?? prog.score ?? prog.pct ?? 0);
          const attempts = Number(prog.attempts ?? prog.tries ?? prog.count ?? 0);
          const dateStr = formatDate(prog.lastDate || prog.lastAt || prog.updatedAt || prog.date);

          if (passed) passedCount++;

          const badgeHtml = passed
            ? `<span class="badge st-done">Đã qua ✅</span>`
            : inProgress
              ? `<span class="badge st-learning">Đang học</span>`
              : `<span class="badge st-none">Đã nạp (${slot.wordCount} từ)</span>`;

          const subText = attempts > 0
            ? `${slot.wordCount} từ • Cao nhất: ${best}% (${attempts} lần)`
            : inProgress
              ? `${slot.wordCount} từ • Đã mở học, chưa thi qua bài`
              : `${slot.wordCount} từ • Sẵn sàng luyện tập`;

          return `
            <a href="#/${level.toLowerCase()}/${cat.id}?lesson=${encodeURIComponent(slot.id)}" class="card v-row prg-lesson-link">
              <div class="col gap-4">
                <span class="prg-lesson-name">${escapeHtml(slot.name)}</span>
                <span class="text-sm text-muted">${subText}</span>
              </div>
              <div class="prg-lesson-side">
                ${badgeHtml}
                <span class="prg-lesson-date">${escapeHtml(String(dateStr))}</span>
              </div>
            </a>`;
        }).join('');

        const pct = total > 0 ? Math.round((passedCount / total) * 100) : 0;
        const summaryLabel = cat.ready && total > 0
          ? `${cat.icon} ${cat.label} (${cat.smRange}): ${passedCount}/${total} ngày đã qua`
          : `${cat.icon} ${cat.label} (${cat.smRange}): Sắp ra mắt`;

        const bodyHtml = isOpen
          ? (cat.ready && total
              ? `<div class="module-grid mt-12">${cardsHtml}</div>`
              : `<div class="card center text-muted prg-empty-box">Phần ${escapeHtml(cat.label)} (${escapeHtml(cat.smRange)}) Sou-matome ${escapeHtml(level)} sẽ được mở ở bước tiếp theo.</div>`)
          : '';

        return `
          <section class="prg-sec">
            <button type="button" class="card w-full prog-toggle-head prg-head ${isOpen ? 'is-open' : ''}" data-cat="${cat.id}" aria-expanded="${isOpen}">
              <div class="row-between w-full prg-head-row">
                <span class="prg-head-title">${summaryLabel}</span>
                <div class="row prg-head-right">
                  <span class="prg-pct-pill">${pct}%</span>
                  <span class="prg-caret ${isOpen ? 'is-open' : ''}">▾</span>
                </div>
              </div>
              <div class="w-full prg-track">
                <div class="prg-fill" style="--p:${pct}"></div>
              </div>
            </button>
            ${bodyHtml}
          </section>`;
      }

      const lessons = rikiByCat[cat.id] || [];
      const cardsHtml = lessons.map((les) => {
        const prog = getLessonProgress(level, cat.id, les.id) || {};
        const passed = prog.status === 'done';
        const inProgress = !passed && prog.status === 'learning';
        const best = Number(prog.bestPct ?? prog.bestScore ?? prog.highScore ?? prog.best ?? prog.score ?? prog.pct ?? 0);
        const attempts = Number(prog.attempts ?? prog.tries ?? prog.count ?? 0);
        const dateStr = formatDate(prog.lastDate || prog.lastAt || prog.updatedAt || prog.date);

        if (passed) passedCount++;

        const badgeHtml = passed
          ? `<span class="badge st-done">Đã qua ✅</span>`
          : inProgress
            ? `<span class="badge st-learning">Đang học</span>`
            : `<span class="badge st-none">Chưa học</span>`;

        const subText = attempts > 0
          ? `Cao nhất: ${best}% • ${attempts} lần thử`
          : inProgress
            ? 'Đã mở học • Chưa kiểm tra qua bài'
            : 'Chưa kiểm tra • 0 lần thử';

        return `
          <a href="#/${level.toLowerCase()}/${cat.id}?lesson=${encodeURIComponent(les.id)}" class="card v-row prg-lesson-link">
            <div class="col gap-4">
              <span class="prg-lesson-name">${escapeHtml(les.name)}</span>
              <span class="text-sm text-muted">${subText}</span>
            </div>
            <div class="prg-lesson-side">
              ${badgeHtml}
              <span class="prg-lesson-date">${escapeHtml(String(dateStr))}</span>
            </div>
          </a>`;
      }).join('');

      const total = cat.ready ? lessons.length : 0;
      const pct = total > 0 ? Math.round((passedCount / total) * 100) : 0;
      const summaryLabel = cat.ready && total > 0
        ? `${cat.icon} ${cat.label}: ${passedCount}/${total} bài đã qua`
        : cat.icon === '漢' || cat.ready
          ? `${cat.icon} ${cat.label}: Chưa có dữ liệu`
          : `${cat.icon} ${cat.label}: Sắp ra mắt`;

      const bodyHtml = isOpen
        ? (cat.ready && lessons.length
            ? `<div class="module-grid mt-12">${cardsHtml}</div>`
            : `<div class="card center text-muted prg-empty-box">Nội dung ${escapeHtml(cat.label)} ${escapeHtml(level)} đang được cập nhật.</div>`)
        : '';

      return `
        <section class="prg-sec">
          <button type="button" class="card w-full prog-toggle-head prg-head ${isOpen ? 'is-open' : ''}" data-cat="${cat.id}" aria-expanded="${isOpen}">
            <div class="row-between w-full prg-head-row">
              <span class="prg-head-title">${summaryLabel}</span>
              <div class="row prg-head-right">
                <span class="prg-pct-pill">${pct}%</span>
                <span class="prg-caret ${isOpen ? 'is-open' : ''}">▾</span>
              </div>
            </div>
            <div class="w-full prg-track">
              <div class="prg-fill" style="--p:${pct}"></div>
            </div>
          </button>
          ${bodyHtml}
        </section>`;
    }).join('');

    container.innerHTML = `
      <div class="row-between mb-12">
        <div class="page-title" style="margin:0;">Tiến độ ${escapeHtml(level)}</div>
        ${renderBookDropdown('prg-book-dd')}
      </div>
      ${sectionsHtml}
    `;

    bindBookDropdown(container, () => render(), 'prg-book-dd');

    container.querySelectorAll('.prog-toggle-head').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.cat;
        openState[id] = !openState[id];
        render();
      };
    });
  }

  render();
}