import { getStore } from '../core/store.js';
import { PASS_RATE } from '../core/progress.js';
import { escapeHtml } from '../core/util.js';

const CATEGORIES = [
  { id: 'vocab', label: 'Từ vựng', icon: '📚', ready: true },
  { id: 'grammar', label: 'Ngữ pháp', icon: '🧩', ready: false },
  { id: 'kanji', label: 'Kanji', icon: '漢', ready: false },
  { id: 'reading', label: 'Đọc hiểu', icon: '📖', ready: false },
  { id: 'listening', label: 'Nghe hiểu', icon: '🎧', ready: false }
];

const LEVEL_LESSONS = {
  N5: Array.from({ length: 25 }, (_, i) => ({ id: `bai-${i + 1}`, name: `Bài ${i + 1}` })),
  N4: Array.from({ length: 25 }, (_, i) => ({ id: `bai-${i + 26}`, name: `Bài ${i + 26}` })),
  N3: [],
  N2: [],
  N1: []
};

function getCurrentLevel() {
  const appStore = getStore('app', {});
  return appStore.level || localStorage.getItem('manabi:level') || 'N4';
}

function getCategoryRecords(level, catId) {
  const prog = getStore('progress', {});
  if (prog?.[level]?.[catId]) return prog[level][catId];
  try {
    const raw = JSON.parse(localStorage.getItem('manabi:progress') || '{}');
    return raw?.[level]?.[catId] || {};
  } catch {
    return {};
  }
}

export function mountProgress(container) {
  const level = getCurrentLevel();
  const openState = { vocab: true, grammar: false, kanji: false, reading: false, listening: false };
  const reqPct = Math.round((PASS_RATE || 0.8) * 100);

  function render() {
    const sectionsHtml = CATEGORIES.map((cat) => {
      const lessons = LEVEL_LESSONS[level] || [];
      const records = getCategoryRecords(level, cat.id);
      const isOpen = Boolean(openState[cat.id]);

      let passedCount = 0;
      const cardsHtml = lessons.map((les) => {
        const rec = records[les.id] || records[les.name] || {};
        const best = Number(rec.best ?? rec.score ?? 0);
        const attempts = Number(rec.attempts ?? rec.tries ?? 0);
        const passed = Boolean(rec.passed || best >= reqPct);
        const inProgress = !passed && (attempts > 0 || Boolean(rec.lastDate || rec.date));
        const dateStr = rec.lastDate || rec.date || '—';

        if (passed) passedCount++;

        const badgeHtml = passed
          ? `<span style="padding:3px 10px;border-radius:999px;font-size:0.78rem;font-weight:800;border:1.5px solid var(--green);color:var(--green);background:rgba(76,175,106,0.14);">Đã qua ✅</span>`
          : inProgress
            ? `<span style="padding:3px 10px;border-radius:999px;font-size:0.78rem;font-weight:800;border:1.5px solid var(--yellow);color:var(--yellow);background:rgba(245,200,79,0.14);">Đang học</span>`
            : `<span style="padding:3px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;border:1.5px solid var(--border);color:var(--text-muted);background:var(--bg-elevated);">Chưa học</span>`;

        const subText = attempts > 0
          ? `Cao nhất: ${best}% • ${attempts} lần thử`
          : `Chưa kiểm tra • 0 lần thử`;

        return `
          <a href="#/practice" class="card v-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;color:inherit;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-weight:800;font-size:1.05rem;">${escapeHtml(les.name)}</span>
              <span style="font-size:0.84rem;color:var(--text-muted);font-weight:600;">${subText}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
              ${badgeHtml}
              <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">${escapeHtml(dateStr)}</span>
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
            ? `<div class="module-grid" style="margin-top:12px;">${cardsHtml}</div>`
            : `<div class="card" style="margin-top:10px;padding:18px;text-align:center;color:var(--text-muted);font-weight:600;">Nội dung ${escapeHtml(cat.label)} ${escapeHtml(level)} đang được cập nhật.</div>`)
        : '';

      return `
        <section style="margin-bottom:16px;">
          <button type="button" class="card prog-toggle-head" data-cat="${cat.id}" aria-expanded="${isOpen}"
            style="width:100%;text-align:left;cursor:pointer;padding:16px 18px;display:flex;flex-direction:column;gap:10px;border-color:${isOpen ? 'var(--teal)' : 'var(--border)'};">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;">
              <span style="font-weight:800;font-size:1.05rem;color:var(--text);">${summaryLabel}</span>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <span style="padding:2px 10px;border-radius:999px;background:rgba(91,192,190,0.18);border:1.5px solid var(--teal);color:var(--teal);font-weight:800;font-size:0.82rem;">${pct}%</span>
                <span style="width:28px;height:28px;border-radius:8px;background:var(--bg-elevated);border:1.5px solid var(--border);display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:var(--text);transition:transform 0.18s ease;transform:rotate(${isOpen ? '0deg' : '-90deg'});">▾</span>
              </div>
            </div>
            <div style="width:100%;height:10px;background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:999px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--green);border-radius:999px;transition:width 0.25s ease;"></div>
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