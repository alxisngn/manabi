import { getLevel } from '../core/nav.js';
import { getLessonProgress } from '../core/progress.js';
import { escapeHtml } from '../core/util.js';

const CATEGORIES = [
  { id: 'vocab', label: 'Từ vựng', icon: '📚', ready: true },
  { id: 'grammar', label: 'Ngữ pháp', icon: '🧩', ready: false },
  { id: 'kanji', label: 'Kanji', icon: '漢', ready: false },
  { id: 'reading', label: 'Đọc hiểu', icon: '📖', ready: false },
  { id: 'listening', label: 'Nghe hiểu', icon: '🎧', ready: false }
];

const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

async function fetchVocabLessons(level) {
  try {
    const res = await fetch(`data/${level.toLowerCase()}/vocab/index.json`);
    if (!res.ok) return [];
    const list = (await res.json())?.lessons || [];
    return list.map((l) => ({ id: l.id, name: cleanName(l.name) }));
  } catch {
    return [];
  }
}

export async function mount(container) {
  const level = (getLevel() || 'N4').toUpperCase();
  const openState = { vocab: true, grammar: false, kanji: false, reading: false, listening: false };

  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải tiến độ...</p></div>`;
  const vocabLessons = await fetchVocabLessons(level);

  function render() {
    const sectionsHtml = CATEGORIES.map((cat) => {
      const lessons = cat.id === 'vocab' ? vocabLessons : [];
      const isOpen = Boolean(openState[cat.id]);
      let passedCount = 0;

      const formatDate = (val) => {
        if (!val) return '—';
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('vi-VN');
      };

      const cardsHtml = lessons.map((les) => {
        const prog = getLessonProgress(level, cat.id, les.id) || {};
        const passed = prog.status === 'done';
        const inProgress = !passed && prog.status === 'learning';
        const best = Number(prog.bestPct ?? prog.bestScore ?? prog.highScore ?? prog.best ?? prog.score ?? prog.pct ?? 0);
        const attempts = Number(prog.attempts ?? prog.tries ?? prog.count ?? 0);
        const dateStr = formatDate(prog.lastDate || prog.updatedAt || prog.date);

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
          <a href="#/${level.toLowerCase()}/vocab?lesson=${encodeURIComponent(les.id)}" class="card v-row prg-lesson-link">
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
      <div class="page-title">Tiến độ ${escapeHtml(level)}</div>
      ${sectionsHtml}
    `;

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