import { getSummary } from '../../core/progress.js';
import { escapeHtml } from '../../core/util.js';

export async function mount(container, { level, query }) {
  const lv = String(level || 'N4').toLowerCase();
  const baseHash = `#/${lv}/grammar`;
  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải ngữ pháp...</p></div>`;

  let lessons = [];
  try {
    const res = await fetch(`data/${lv}/grammar/index.json`);
    if (res.ok) lessons = (await res.json())?.lessons || [];
  } catch {}

  const pickId = query?.get('lesson');
  if (pickId) {
    const found = lessons.find((l) => l.id === pickId);
    if (found) {
      const res = await fetch(`data/${lv}/grammar/${found.file}`);
      if (res.ok) {
        const data = await res.json();
        const mod = found.type === 'weekly_test' || data.lesson?.type === 'weekly_test'
          ? await import('./test.js')
          : await import('./lesson.js');
        mod.mount(container, { level: level.toUpperCase(), meta: found, data, backHash: baseHash });
        return;
      }
    }
  }

  const summary = getSummary(level, 'grammar', lessons);
  const statusMap = new Map(summary.items.map((it) => [it.lessonId, it]));

  const weeks = new Map();
  lessons.forEach((l) => {
    const w = l.week || 1;
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(l);
  });

  const weeksHtml = [...weeks.entries()].map(([wk, list]) => {
    const days = list.filter((l) => l.type !== 'weekly_test');
    const test = list.find((l) => l.type === 'weekly_test');
    const doneCnt = list.filter((l) => statusMap.get(l.id)?.status === 'done').length;

    const dayBtns = days.map((d) => {
      const st = statusMap.get(d.id)?.status || 'none';
      const cls = st === 'done' ? 'is-done' : st === 'learning' ? 'is-learning' : '';
      return `<button type="button" class="btn gr-day-btn ${cls}" data-open="${escapeHtml(d.id)}">
        <span class="gr-day-num">Ngày ${d.day || ''}</span>
        <span class="gr-day-cnt">${d.count} mẫu</span>
      </button>`;
    }).join('');

    const testRec = test ? statusMap.get(test.id) : null;
    const testBadge = testRec?.bestPct != null ? `${testRec.bestPct}/100đ` : '18 câu • 20p';
    const testHtml = test
      ? `<button type="button" class="btn btn-coral gr-test-btn" data-open="${escapeHtml(test.id)}">
          <span>📝 ${escapeHtml(test.name)}</span>
          <span class="badge">${testBadge}</span>
        </button>`
      : '';

    return `<article class="card gr-week-card">
      <div class="gr-top">
        <h2 class="modal-title">Tuần ${wk}</h2>
        <span class="badge ${doneCnt === list.length ? 'badge-ready' : ''}">${doneCnt}/${list.length} ngày</span>
      </div>
      <div class="gr-day-grid">${dayBtns}</div>
      ${testHtml}
    </article>`;
  }).join('');

  container.innerHTML = `
    <div class="gr-wrap">
      <div class="gr-top">
        <a href="#/learn" class="btn gr-pill">← Kỹ năng</a>
        <h1 class="gr-top-title">Ngữ pháp ${escapeHtml(level.toUpperCase())}</h1>
        <span class="badge">${summary.done}/${summary.total}</span>
      </div>
      ${weeksHtml || '<div class="card"><p class="module-sub">Chưa có dữ liệu ngữ pháp.</p></div>'}
    </div>
  `;

  container.querySelectorAll('[data-open]').forEach((btn) => {
    btn.onclick = () => {
      window.location.hash = `${baseHash}?lesson=${encodeURIComponent(btn.dataset.open)}`;
    };
  });
}