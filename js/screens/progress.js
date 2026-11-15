import { getLevel } from '../core/nav.js';
import { getSummary } from '../core/progress.js';
import { escapeHtml } from '../core/util.js';

const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function mount(container) {
  const lv = getLevel();
  const lvLower = lv.toLowerCase();
  container.innerHTML = `<h1 class="page-title">Tiến độ ${lv}</h1><div class="card"><p class="module-sub">Đang tải tiến độ...</p></div>`;

  let lessons = [];
  try {
    const res = await fetch(`data/${lvLower}/vocab/index.json`);
    if (res.ok) {
      lessons = ((await res.json())?.lessons || []).map((l) => ({ id: l.id, name: cleanName(l.name) }));
    }
  } catch {}

  const summary = getSummary(lv, 'vocab', lessons);
  const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  const listHtml = summary.items.map((it) => {
    const stCls = it.status === 'done' ? 'st-done' : it.status === 'learning' ? 'st-learning' : 'st-none';
    const stTxt = it.status === 'done' ? 'Đã qua ✅' : it.status === 'learning' ? 'Đang học' : 'Chưa học';
    const bestTxt = it.bestPct != null ? `Cao nhất: ${it.bestPct}%` : 'Chưa kiểm tra';
    return `
      <a href="#/${lvLower}/vocab" class="card prog-item">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <span style="font-weight:800;font-size:1.02rem;">${escapeHtml(it.name)}</span>
          <span class="badge ${stCls}">${stTxt}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:0.82rem;color:var(--text-muted);font-weight:600;">
          <span>${bestTxt} • ${it.attempts} lần thử</span>
          <span>${formatDate(it.lastAt)}</span>
        </div>
      </a>`;
  }).join('');

  container.innerHTML = `
    <h1 class="page-title">Tiến độ ${lv}</h1>

    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <span class="module-title" style="font-size:1.08rem;">Từ vựng: ${summary.done}/${summary.total} bài đã qua</span>
        <span class="badge badge-ready">${pct}%</span>
      </div>
      <div class="prog-bar">
        <div class="prog-bar-fill" style="width:${pct}%;"></div>
      </div>
    </div>

    <div class="module-grid">
      ${listHtml || `<div class="card"><p class="module-sub">Chưa có danh sách bài học cho ${lv}.</p></div>`}
    </div>
  `;
}