import { getStore } from '../core/store.js';
import { getLevel } from '../core/nav.js';
import { getSummary, getLastStudiedSkill } from '../core/progress.js';
import { escapeHtml } from '../core/util.js';

const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

const SKILL_META = {
  vocab: { name: 'Từ vựng', icon: '語', accent: 'accent-teal' },
  kanji: { name: 'Kanji', icon: '漢', accent: 'accent-yellow' }
};

export async function mount(container) {
  const lv = getLevel();
  const lvLower = lv.toLowerCase();
  const lastSkill = getLastStudiedSkill(lv);
  const sk = SKILL_META[lastSkill] ? lastSkill : 'vocab';
  const meta = SKILL_META[sk];
  const st = getStore(sk, { weakWords: [] });
  const weakCount = (st.weakWords || []).length;

  let nextCardHtml = `<div class="card"><p class="module-sub">Đang tải bài học tiếp theo...</p></div>`;
  const renderShell = () => {
    container.innerHTML = `
      <h1 class="page-title">Hôm nay</h1>
      <div class="module-grid">
        <div class="card row-between">
          <div>
            <div class="module-sub">Mục tiêu hiện tại</div>
            <div class="module-title">Cấp đang học: ${lv}</div>
          </div>
          <span class="badge badge-ready">JLPT ${lv}</span>
        </div>

        ${nextCardHtml}

        <div class="card row-between">
          <div>
            <div class="module-title">Từ cần ôn lại: ${weakCount} từ</div>
            <div class="module-sub">Tự lưu khi làm sai hoặc đánh dấu</div>
          </div>
          <button type="button" id="today-weak-btn" class="btn btn-coral" ${weakCount === 0 ? 'disabled' : ''}>
            ▶ Ôn ngay
          </button>
        </div>

        <a href="#/${lvLower}/${sk}" class="card module-card is-active">
          <div class="module-left">
            <div class="module-icon ${meta.accent}">${meta.icon}</div>
            <div>
              <div class="module-title">Tiếp tục học ${meta.name}</div>
              <div class="module-sub">Luyện tập theo bài hoặc ôn tổng hợp ${lv}</div>
            </div>
          </div>
          <span class="badge badge-ready">Học →</span>
        </a>
      </div>`;

    const weakBtn = container.querySelector('#today-weak-btn');
    if (weakBtn && weakCount > 0) {
      weakBtn.onclick = () => { window.location.hash = `#/${lvLower}/${sk}?view=study-weak`; };
    }
  };

  renderShell();

  try {
    const res = await fetch(`data/${lvLower}/${sk}/index.json`);
    const lessons = res.ok ? ((await res.json())?.lessons || []).map((l) => ({ id: l.id, name: cleanName(l.name) })) : [];
    const summary = getSummary(lv, sk, lessons);
    const nextItem = summary.items.find((it) => it.status !== 'done');

    if (summary.total > 0 && !nextItem) {
      nextCardHtml = `
        <div class="card row-between">
          <div>
            <div class="module-sub">Bài tiếp theo • ${meta.name} (${lv})</div>
            <div class="module-title">Bạn đã qua hết các bài! 🎉</div>
          </div>
          <span class="badge st-done">${summary.done}/${summary.total}</span>
        </div>`;
    } else if (nextItem) {
      const idEnc = encodeURIComponent(nextItem.lessonId);
      nextCardHtml = `
        <div class="card col">
          <div class="row-between">
            <div>
              <div class="module-sub">Bài tiếp theo • ${meta.name} (${lv})</div>
              <div class="module-title">${escapeHtml(nextItem.name)}</div>
            </div>
            <span class="badge ${nextItem.status === 'learning' ? 'st-learning' : 'st-none'}">
              ${nextItem.status === 'learning' ? 'Đang học' : 'Chưa học'}
            </span>
          </div>
          <div class="grid-2">
            <a href="#/${lvLower}/${sk}?lesson=${idEnc}" class="btn">📖 Học</a>
            <a href="#/${lvLower}/${sk}?gate=${idEnc}" class="btn btn-teal">✅ Kiểm tra</a>
          </div>
        </div>`;
    } else {
      nextCardHtml = '';
    }
    renderShell();
  } catch {
    nextCardHtml = '';
    renderShell();
  }
}