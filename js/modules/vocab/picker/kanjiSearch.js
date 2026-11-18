import { escapeHtml } from '../../../core/util.js';
import { updateStore } from '../../../core/store.js';
import { fetchWords, DEFAULT_STORE } from './data.js';

const allWordsCache = {};
const uiState = {
  open: false,
  week: 1,
  addingDay: null,
  query: '',
  extraDraft: '',
  candidates: [],
  selectedWords: [],
  errMsg: ''
};

async function loadAllSkillWords(lessons, level, skill) {
  const key = `${level}:${skill}`;
  if (allWordsCache[key]) return allWordsCache[key];
  const repoItems = lessons.filter((l) => l.source === 'repo');
  const buckets = await Promise.all(repoItems.map((l) => fetchWords(l, level, skill)));
  const flat = buckets.flat();
  allWordsCache[key] = flat;
  return flat;
}

export const parseSomatomeTag = (name) => {
  const m = String(name || '').match(/Tuần\s*([1-6])\s*[-–—]\s*Ngày\s*([1-6])/i);
  return m ? { week: Number(m[1]), day: Number(m[2]) } : null;
};

function parseQuickWordInput(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return null;

  if (clean.includes('|')) {
    const parts = clean.split('|').map((s) => s.trim());
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      return { jp: parts[0], reading: parts[1], vi: parts.slice(2).join(' '), pos: 'noun' };
    }
    return null;
  }

  const tokens = clean.split(/[\s\u3000]+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const jp = tokens[0];
  const isPureKana = /^[\u3040-\u30FFー・〜]+$/.test(jp);

  if (tokens.length === 2 && isPureKana) {
    return { jp, reading: jp, vi: tokens[1], pos: 'noun' };
  }
  if (tokens.length >= 3) {
    return { jp, reading: tokens[1], vi: tokens.slice(2).join(' '), pos: 'noun' };
  }
  return null;
}

function resetAddDraft() {
  uiState.addingDay = null;
  uiState.query = '';
  uiState.extraDraft = '';
  uiState.candidates = [];
  uiState.selectedWords = [];
  uiState.errMsg = '';
}

const isPicked = (jp) => uiState.selectedWords.some((w) => w.jp === jp);

function toggleWordSelection(word) {
  const idx = uiState.selectedWords.findIndex((w) => w.jp === word.jp);
  if (idx >= 0) uiState.selectedWords.splice(idx, 1);
  else uiState.selectedWords.push({ ...word });
}

export function renderKanjiFilterCard(activeLevel, customLessons = []) {
  const tagged = new Map();
  const untagged = [];

  customLessons.forEach((cl) => {
    const tag = parseSomatomeTag(cl.name);
    if (tag) tagged.set(`${tag.week}-${tag.day}`, cl);
    else untagged.push(cl);
  });

  const totalSaved = tagged.size;
  if (!uiState.open) {
    return `
      <div class="mb-12">
        <button type="button" id="sm-toggle" class="card w-full prg-head pk-card-yellow" aria-expanded="false">
          <div class="row-between w-full prg-head-row">
            <div class="module-left">
              <div class="module-icon accent-yellow">📒</div>
              <div>
                <div class="module-title">Sách So-matome ${escapeHtml(activeLevel)}</div>
                <div class="module-sub">Tuần 1 – 6 • ${totalSaved ? `Đã lưu ${totalSaved}/36 ngày` : 'Bấm để chọn Tuần & Ngày học'}</div>
              </div>
            </div>
            <span class="prg-caret">▾</span>
          </div>
        </button>
      </div>`;
  }

  const weeksHtml = [1, 2, 3, 4, 5, 6].map((w) => {
    const on = uiState.week === w;
    return `<button type="button" class="pk-pill ${on ? 'is-on' : ''}" data-sm-week="${w}">Tuần ${w}</button>`;
  }).join('');

  const daysHtml = [1, 2, 3, 4, 5, 6].map((d) => {
    const existing = tagged.get(`${uiState.week}-${d}`);
    if (existing) {
      return `
        <div class="card v-row">
          <button type="button" class="v-item v-row-main" data-id="${escapeHtml(existing.id)}">
            <div>
              <div class="pk-item-title">Ngày ${d}</div>
              <div class="pk-item-meta"><span class="badge badge-ready">${existing.count} từ →</span></div>
            </div>
          </button>
          <button type="button" class="btn btn-sm" data-edit-alb="${escapeHtml(existing.id)}">✏️ Sửa</button>
        </div>`;
    }
    if (uiState.addingDay !== d) {
      return `
        <div class="card v-row">
          <div>
            <div class="pk-item-title">Ngày ${d}</div>
            <div class="module-sub">Chưa nạp chữ Hán</div>
          </div>
          <button type="button" class="btn btn-yellow btn-sm" data-sm-add-day="${d}">＋ Nạp</button>
        </div>`;
    }

    const importOpts = untagged.map((al) => `<option value="${escapeHtml(al.id)}">${escapeHtml(al.name)} (${al.count} từ)</option>`).join('');
    const importHtml = untagged.length ? `
      <div class="col gap-8">
        <div class="module-sub">Hoặc chuyển từ Album đã tạo trước đó:</div>
        <div class="pk-rng-row">
          <select id="sm-pick-existing" class="pk-rng-sel">${importOpts}</select>
          <span></span><span></span>
          <button type="button" id="sm-move-existing" class="btn btn-teal">Gắn vào Ngày ${d}</button>
        </div>
      </div>` : '';

    const pickedCount = uiState.selectedWords.length;
    const candHtml = uiState.candidates.length ? `
      <div class="col gap-8">
        <div class="row-between">
          <span class="text-sm text-muted">Kết quả tìm kiếm (chạm để chọn):</span>
          <div class="row gap-4">
            <button type="button" id="kj-pick-all" class="btn pk-tool-btn">Chọn hết</button>
            <button type="button" id="kj-pick-none" class="btn pk-tool-btn">Bỏ chọn</button>
          </div>
        </div>
        <div class="pk-local-pills">
          ${uiState.candidates.map((w, idx) => {
            const on = isPicked(w.jp);
            return `<button type="button" class="pk-local-pill ${on ? 'is-on' : ''}" data-kj-pick="${idx}">${on ? '✓ ' : ''}${escapeHtml(w.jp)} (${escapeHtml(w.vi)})</button>`;
          }).join('')}
        </div>
      </div>` : '';

    const basketHtml = pickedCount ? `
      <div class="col gap-8">
        <div class="row-between">
          <span class="text-sm pk-bold">Đã chọn (${pickedCount} từ — bấm để bỏ):</span>
          <button type="button" id="kj-clear-basket" class="btn pk-tool-btn">Xóa hết</button>
        </div>
        <div class="pk-local-pills">
          ${uiState.selectedWords.map((w, idx) => `<button type="button" class="pk-local-pill is-on" data-kj-drop="${idx}">✓ ${escapeHtml(w.jp)} (${escapeHtml(w.vi)})</button>`).join('')}
        </div>
      </div>` : '';

    return `
      <div class="card col pk-card-yellow">
        <div class="row-between">
          <div class="pk-item-title">Nạp Ngày ${d}</div>
          <button type="button" id="sm-cancel-add" class="btn btn-icon btn-sm" title="Đóng">✕</button>
        </div>
        ${importHtml}
        <div class="pk-rng-row">
          <input type="text" id="kj-filter-inp" class="inp" value="${escapeHtml(uiState.query)}" placeholder="1. Gõ từng chữ hoặc cụm Kanji..." autocomplete="off" />
          <button type="button" id="kj-search-btn" class="btn btn-teal">Tìm từ</button>
        </div>
        ${candHtml}
        <div class="col gap-8">
          <div class="text-sm text-muted">2. Thêm từ ngoài kho Riki (cách nhau dấu cách):</div>
          <div class="pk-rng-row">
            <input type="text" id="kj-extra-inp" class="inp" value="${escapeHtml(uiState.extraDraft)}" placeholder="VD: 建物 たてもの tòa nhà" autocomplete="off" />
            <button type="button" id="kj-extra-add" class="btn">＋ Thêm</button>
          </div>
        </div>
        ${basketHtml}
        ${uiState.errMsg ? `<div id="kj-filter-msg" class="pk-err">${escapeHtml(uiState.errMsg)}</div>` : ''}
        <button type="button" id="kj-filter-go" class="btn btn-yellow w-full" ${pickedCount === 0 ? 'disabled' : ''}>
          Lưu Ngày ${d} (${pickedCount} từ) ✓
        </button>
      </div>`;
  }).join('');

  return `
    <div class="card col mb-12 pk-card-yellow">
      <button type="button" id="sm-toggle" class="v-row-main row-between w-full" aria-expanded="true">
        <div class="module-left">
          <div class="module-icon accent-yellow">📒</div>
          <div>
            <div class="module-title">Sách So-matome ${escapeHtml(activeLevel)}</div>
            <div class="module-sub">Chọn tuần & ngày để ôn hoặc nạp chữ Hán</div>
          </div>
        </div>
        <span class="prg-caret is-open">▾</span>
      </button>
      <div class="grid-2">${weeksHtml}</div>
      <div class="col gap-8">${daysHtml}</div>
    </div>`;
}

export function bindKanjiFilter(container, ctx) {
  container.querySelector('#sm-toggle')?.addEventListener('click', () => {
    uiState.open = !uiState.open;
    resetAddDraft();
    ctx.render();
  });

  container.querySelectorAll('[data-sm-week]').forEach((btn) => {
    btn.onclick = () => {
      uiState.week = Number(btn.dataset.smWeek);
      resetAddDraft();
      ctx.render();
    };
  });

  container.querySelectorAll('[data-sm-add-day]').forEach((btn) => {
    btn.onclick = () => {
      resetAddDraft();
      uiState.addingDay = Number(btn.dataset.smAddDay);
      ctx.render();
      container.querySelector('#kj-filter-inp')?.focus();
    };
  });

  container.querySelector('#sm-cancel-add')?.addEventListener('click', () => {
    resetAddDraft();
    ctx.render();
  });

  container.querySelector('#sm-move-existing')?.addEventListener('click', () => {
    const targetId = container.querySelector('#sm-pick-existing')?.value;
    if (!targetId) return;
    const dayNum = uiState.addingDay || 1;
    const albumName = `Tuần ${uiState.week} - Ngày ${dayNum}`;
    const nowIso = new Date().toISOString();

    updateStore(ctx.storeKey, (cur) => {
      const list = (cur?.customLessons || []).map((cl) =>
        String(cl.id) === String(targetId) ? { ...cl, name: albumName, updatedAt: nowIso } : cl
      );
      return { ...cur, customLessons: list };
    }, DEFAULT_STORE);

    resetAddDraft();
    ctx.refresh?.();
    ctx.render();
  });

  const inp = container.querySelector('#kj-filter-inp');
  const searchBtn = container.querySelector('#kj-search-btn');
  const extraInp = container.querySelector('#kj-extra-inp');
  const saveBtn = container.querySelector('#kj-filter-go');
  if (!inp) return;

  inp.oninput = () => { uiState.query = inp.value; };
  if (extraInp) extraInp.oninput = () => { uiState.extraDraft = extraInp.value; };

  const runSearch = async () => {
    const raw = inp.value.trim();
    uiState.query = raw;
    const chars = [...new Set(raw.match(/[\u4E00-\u9FAF]/g) || [])];
    if (!chars.length) {
      uiState.errMsg = 'Vui lòng nhập ít nhất 1 chữ Hán (ví dụ: 通).';
      return ctx.render();
    }
    if (searchBtn) searchBtn.disabled = true;
    const allWords = await loadAllSkillWords(ctx.lessons, ctx.activeLevel, ctx.skill);
    if (searchBtn) searchBtn.disabled = false;

    const matched = [];
    const seen = new Set();
    allWords.forEach((w) => {
      const hit = chars.some((ch) => w.kanji === ch || String(w.jp || '').includes(ch));
      if (hit && !seen.has(w.jp)) {
        seen.add(w.jp);
        matched.push({ ...w });
      }
    });

    uiState.candidates = matched;
    uiState.errMsg = matched.length ? '' : `Không thấy từ nào trong kho Riki chứa: ${chars.join(', ')}. Bạn có thể thêm tay ở mục 2.`;
    ctx.render();
    const nextInp = container.querySelector('#kj-filter-inp');
    if (nextInp) {
      nextInp.focus();
      nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
    }
  };

  if (searchBtn) searchBtn.onclick = runSearch;
  inp.onkeydown = (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };

  container.querySelectorAll('[data-kj-pick]').forEach((b) => {
    b.onclick = () => {
      const w = uiState.candidates[Number(b.dataset.kjPick)];
      if (w) toggleWordSelection(w);
      ctx.render();
    };
  });

  container.querySelectorAll('[data-kj-drop]').forEach((b) => {
    b.onclick = () => {
      const idx = Number(b.dataset.kjDrop);
      uiState.selectedWords.splice(idx, 1);
      ctx.render();
    };
  });

  container.querySelector('#kj-pick-all')?.addEventListener('click', () => {
    uiState.candidates.forEach((w) => { if (!isPicked(w.jp)) uiState.selectedWords.push({ ...w }); });
    ctx.render();
  });

  container.querySelector('#kj-pick-none')?.addEventListener('click', () => {
    const candJps = new Set(uiState.candidates.map((w) => w.jp));
    uiState.selectedWords = uiState.selectedWords.filter((w) => !candJps.has(w.jp));
    ctx.render();
  });

  container.querySelector('#kj-clear-basket')?.addEventListener('click', () => {
    uiState.selectedWords = [];
    ctx.render();
  });

  const runAddExtra = () => {
    const parsed = parseQuickWordInput(extraInp?.value);
    if (!parsed) {
      uiState.errMsg = 'Gõ cách nhau bằng dấu cách: Từ_Nhật Cách_đọc Nghĩa (VD: 建物 たてもの tòa nhà).';
      return ctx.render();
    }
    if (!isPicked(parsed.jp)) uiState.selectedWords.push(parsed);
    uiState.extraDraft = '';
    uiState.errMsg = '';
    ctx.render();
    container.querySelector('#kj-extra-inp')?.focus();
  };

  container.querySelector('#kj-extra-add')?.addEventListener('click', runAddExtra);
  if (extraInp) {
    extraInp.onkeydown = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        runAddExtra();
      }
    };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      const selectedWords = [...uiState.selectedWords];
      if (!selectedWords.length) return;

      const dayNum = uiState.addingDay || 1;
      const albumName = `Tuần ${uiState.week} - Ngày ${dayNum}`;
      const nowIso = new Date().toISOString();
      const albumId = `album-${Date.now()}`;

      updateStore(ctx.storeKey, (cur) => {
        const list = Array.isArray(cur?.customLessons) ? [...cur.customLessons] : [];
        list.unshift({ id: albumId, name: albumName, words: selectedWords, updatedAt: nowIso });
        return { ...cur, customLessons: list };
      }, DEFAULT_STORE);

      resetAddDraft();
      ctx.refresh?.();
      ctx.render();
    };
  }
}