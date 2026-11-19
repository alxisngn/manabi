import { escapeHtml } from '../../../core/util.js';
import { updateStore } from '../../../core/store.js';
import { getLessonProgress } from '../../../core/progress.js';
import { DEFAULT_STORE } from './data.js';
import {
  smUiState as uiState,
  getSomatomeWeeks,
  parseSomatomeTag,
  loadAllSkillWords,
  parseQuickWordInput,
  parseJsonBatch,
  resetAddDraft,
  isPicked,
  toggleWordSelection
} from './somatomeStore.js';

export { getSomatomeWeeks, parseSomatomeTag };

function renderAddDayForm(d, isKanji, untagged) {
  const importOpts = untagged.map((al) => `<option value="${escapeHtml(al.id)}">${escapeHtml(al.name)} (${al.count} từ)</option>`).join('');
  const importHtml = untagged.length ? `
    <div class="col gap-8">
      <div class="module-sub">Chuyển từ Album có sẵn:</div>
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
        <span class="text-sm text-muted">Kết quả (${uiState.candidates.length} — chạm để chọn):</span>
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

  const jsonBoxHtml = uiState.jsonMode ? `
    <div class="col gap-8">
      <div class="text-sm text-muted">Dán mảng JSON từ ảnh chụp sách (<code>[{"jp":"...","reading":"...","vi":"..."}]</code>):</div>
      <textarea id="sm-json-inp" class="inp" rows="4" placeholder='[{"jp":"集まる","reading":"あつまる","vi":"tập trung"}]'>${escapeHtml(uiState.jsonDraft)}</textarea>
      <button type="button" id="sm-json-apply" class="btn btn-teal">Nạp từ JSON vào giỏ</button>
    </div>` : '';

  return `
    <div class="card col pk-card-yellow">
      <div class="row-between">
        <div class="pk-item-title">Nạp Tuần ${uiState.week} - Ngày ${d}</div>
        <div class="row gap-4">
          <button type="button" id="sm-toggle-json" class="btn btn-sm ${uiState.jsonMode ? 'btn-teal' : ''}">📋 Dán JSON</button>
          <button type="button" id="sm-cancel-add" class="btn btn-icon btn-sm" title="Đóng">✕</button>
        </div>
      </div>
      ${jsonBoxHtml}
      ${importHtml}
      <div class="pk-rng-row">
        <input type="text" id="kj-filter-inp" class="inp" value="${escapeHtml(uiState.query)}" placeholder="${isKanji ? '1. Gõ chữ Hán để tìm (VD: 通, 集)...' : '1. Gõ tiếng Nhật hoặc nghĩa Việt...'}" autocomplete="off" />
        <button type="button" id="kj-search-btn" class="btn btn-teal">Tìm từ</button>
      </div>
      ${candHtml}
      <div class="col gap-8">
        <div class="text-sm text-muted">2. Thêm tay nhanh (cách nhau bằng dấu cách):</div>
        <div class="pk-rng-row">
          <input type="text" id="kj-extra-inp" class="inp" value="${escapeHtml(uiState.extraDraft)}" placeholder="${isKanji ? 'VD: 建物 たてもの tòa nhà' : 'VD: しっかり chắc chắn'}" autocomplete="off" />
          <button type="button" id="kj-extra-add" class="btn">＋ Thêm</button>
        </div>
      </div>
      ${basketHtml}
      ${uiState.errMsg ? `<div id="kj-filter-msg" class="pk-err">${escapeHtml(uiState.errMsg)}</div>` : ''}
      <button type="button" id="kj-filter-go" class="btn btn-yellow w-full" ${pickedCount === 0 ? 'disabled' : ''}>
        Lưu Tuần ${uiState.week} - Ngày ${d} (${pickedCount} từ) ✓
      </button>
    </div>`;
}

export function renderSomatomeBook(activeLevel, skill = 'kanji', customLessons = []) {
  const isKanji = skill === 'kanji';
  const weeks = getSomatomeWeeks(skill);
  if (!weeks.includes(uiState.week)) uiState.week = weeks[0];

  const tagged = new Map();
  const untagged = [];
  customLessons.forEach((cl) => {
    const tag = parseSomatomeTag(cl.name);
    if (tag && weeks.includes(tag.week)) tagged.set(`${tag.week}-${tag.day}`, cl);
    else if (!tag) untagged.push(cl);
  });

  const weeksHtml = weeks.map((w) => `<button type="button" class="pk-pill ${uiState.week === w ? 'is-on' : ''}" data-sm-week="${w}">Tuần ${w}</button>`).join('');

  const daysHtml = [1, 2, 3, 4, 5, 6].map((d) => {
    const existing = tagged.get(`${uiState.week}-${d}`);
    if (existing) {
      const prog = getLessonProgress(activeLevel, skill, existing.id);
      const stCls = prog?.status === 'done' ? 'st-done' : prog?.status === 'learning' ? 'st-learning' : 'st-none';
      const stTxt = prog?.status === 'done' ? 'Đã qua ✅' : prog?.status === 'learning' ? 'Đang học' : 'Chưa học';
      return `
        <div class="card v-row">
          <button type="button" class="v-item v-row-main" data-id="${escapeHtml(existing.id)}">
            <div>
              <div class="pk-item-title">Ngày ${d}</div>
              <div class="pk-item-meta"><span class="badge ${stCls}">${stTxt}</span><span class="pk-item-count">${existing.count} từ</span></div>
            </div>
          </button>
          <div class="row gap-4">
            <button type="button" class="btn btn-sm" data-edit-alb="${escapeHtml(existing.id)}" title="Sửa từ">✏️</button>
            <button type="button" class="btn btn-teal btn-sm v-gate-btn" data-gate="${escapeHtml(existing.id)}">Kiểm tra</button>
          </div>
        </div>`;
    }
    if (uiState.addingDay !== d) {
      return `
        <div class="card v-row">
          <div><div class="pk-item-title">Ngày ${d}</div><div class="module-sub">Chưa nạp ${isKanji ? 'chữ Hán' : 'từ vựng'}</div></div>
          <button type="button" class="btn btn-yellow btn-sm" data-sm-add-day="${d}">＋ Nạp</button>
        </div>`;
    }
    return renderAddDayForm(d, isKanji, untagged);
  }).join('');

  return `
    <div class="card col mb-12 pk-card-yellow">
      <div class="row-between">
        <div class="module-left">
          <div class="module-icon accent-yellow">📒</div>
          <div>
            <div class="module-title">Sou-matome ${escapeHtml(activeLevel)} • ${isKanji ? 'Kanji (Tuần 1–3)' : 'Từ vựng (Tuần 4–6)'}</div>
            <div class="module-sub">Đã nạp ${tagged.size}/${weeks.length * 6} ngày trong sách</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0;">${weeksHtml}</div>
      <div class="col gap-8">${daysHtml}</div>
    </div>`;
}

export function bindSomatomeBook(container, ctx) {
  container.querySelectorAll('[data-sm-week]').forEach((btn) => {
    btn.onclick = () => { uiState.week = Number(btn.dataset.smWeek); resetAddDraft(); ctx.render(); };
  });
  container.querySelectorAll('[data-sm-add-day]').forEach((btn) => {
    btn.onclick = () => { resetAddDraft(); uiState.addingDay = Number(btn.dataset.smAddDay); ctx.render(); container.querySelector('#kj-filter-inp')?.focus(); };
  });
  container.querySelector('#sm-cancel-add')?.addEventListener('click', () => { resetAddDraft(); ctx.render(); });
  container.querySelector('#sm-toggle-json')?.addEventListener('click', () => { uiState.jsonMode = !uiState.jsonMode; uiState.errMsg = ''; ctx.render(); });

  const jsonInp = container.querySelector('#sm-json-inp');
  if (jsonInp) jsonInp.oninput = () => { uiState.jsonDraft = jsonInp.value; };
  container.querySelector('#sm-json-apply')?.addEventListener('click', () => {
    const parsed = parseJsonBatch(uiState.jsonDraft);
    if (!parsed || !parsed.length) { uiState.errMsg = 'JSON chưa đúng định dạng mảng [{"jp":"...","reading":"...","vi":"..."}].'; return ctx.render(); }
    parsed.forEach((w) => { if (!isPicked(w.jp)) uiState.selectedWords.push(w); });
    uiState.jsonMode = false; uiState.jsonDraft = ''; uiState.errMsg = ''; ctx.render();
  });

  container.querySelector('#sm-move-existing')?.addEventListener('click', () => {
    const targetId = container.querySelector('#sm-pick-existing')?.value;
    if (!targetId) return;
    const albumName = `Tuần ${uiState.week} - Ngày ${uiState.addingDay || 1}`;
    updateStore(ctx.storeKey, (cur) => ({
      ...cur,
      customLessons: (cur?.customLessons || []).map((cl) => String(cl.id) === String(targetId) ? { ...cl, name: albumName, updatedAt: new Date().toISOString() } : cl)
    }), DEFAULT_STORE);
    resetAddDraft(); ctx.refresh?.(); ctx.render();
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
    if (!raw) { uiState.errMsg = 'Vui lòng nhập từ cần tìm.'; return ctx.render(); }
    if (searchBtn) searchBtn.disabled = true;
    const allWords = await loadAllSkillWords(ctx.lessons, ctx.activeLevel, ctx.skill);
    if (searchBtn) searchBtn.disabled = false;

    const matched = [];
    const seen = new Set();
    if (ctx.skill === 'kanji') {
      const chars = [...new Set(raw.match(/[\u4E00-\u9FAF]/g) || [])];
      if (!chars.length) { uiState.errMsg = 'Vui lòng nhập ít nhất 1 chữ Hán (ví dụ: 通).'; return ctx.render(); }
      allWords.forEach((w) => {
        if (chars.some((ch) => w.kanji === ch || String(w.jp || '').includes(ch)) && !seen.has(w.jp)) { seen.add(w.jp); matched.push({ ...w }); }
      });
    } else {
      const terms = raw.toLowerCase().split(/[,、;\n]+/).map((s) => s.trim()).filter(Boolean);
      allWords.forEach((w) => {
        const hay = `${w.jp || ''} ${w.reading || ''} ${w.vi || ''}`.toLowerCase();
        if (terms.some((t) => hay.includes(t)) && !seen.has(w.jp)) { seen.add(w.jp); matched.push({ ...w }); }
      });
    }
    uiState.candidates = matched;
    uiState.errMsg = matched.length ? '' : 'Không tìm thấy từ khớp trong kho có sẵn. Bạn có thể thêm tay ở mục 2 hoặc Dán JSON.';
    ctx.render();
    const nextInp = container.querySelector('#kj-filter-inp');
    if (nextInp) { nextInp.focus(); nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length); }
  };

  if (searchBtn) searchBtn.onclick = runSearch;
  inp.onkeydown = (e) => { if (!e.isComposing && e.keyCode !== 229 && e.key === 'Enter') { e.preventDefault(); runSearch(); } };

  container.querySelectorAll('[data-kj-pick]').forEach((b) => { b.onclick = () => { const w = uiState.candidates[Number(b.dataset.kjPick)]; if (w) toggleWordSelection(w); ctx.render(); }; });
  container.querySelectorAll('[data-kj-drop]').forEach((b) => { b.onclick = () => { uiState.selectedWords.splice(Number(b.dataset.kjDrop), 1); ctx.render(); }; });
  container.querySelector('#kj-pick-all')?.addEventListener('click', () => { uiState.candidates.forEach((w) => { if (!isPicked(w.jp)) uiState.selectedWords.push({ ...w }); }); ctx.render(); });
  container.querySelector('#kj-pick-none')?.addEventListener('click', () => { const c = new Set(uiState.candidates.map((w) => w.jp)); uiState.selectedWords = uiState.selectedWords.filter((w) => !c.has(w.jp)); ctx.render(); });
  container.querySelector('#kj-clear-basket')?.addEventListener('click', () => { uiState.selectedWords = []; ctx.render(); });

  const runAddExtra = () => {
    const parsed = parseQuickWordInput(extraInp?.value);
    if (!parsed) { uiState.errMsg = 'Gõ cách nhau bằng dấu cách: Từ_Nhật Cách_đọc Nghĩa (VD: 建物 たてもの tòa nhà).'; return ctx.render(); }
    if (!isPicked(parsed.jp)) uiState.selectedWords.push(parsed);
    uiState.extraDraft = ''; uiState.errMsg = ''; ctx.render(); container.querySelector('#kj-extra-inp')?.focus();
  };
  container.querySelector('#kj-extra-add')?.addEventListener('click', runAddExtra);
  if (extraInp) extraInp.onkeydown = (e) => { if (!e.isComposing && e.keyCode !== 229 && e.key === 'Enter') { e.preventDefault(); runAddExtra(); } };

  if (saveBtn) {
    saveBtn.onclick = () => {
      if (!uiState.selectedWords.length) return;
      const albumName = `Tuần ${uiState.week} - Ngày ${uiState.addingDay || 1}`;
      updateStore(ctx.storeKey, (cur) => ({
        ...cur,
        customLessons: [{ id: `album-${Date.now()}`, name: albumName, words: [...uiState.selectedWords], updatedAt: new Date().toISOString() }, ...(cur?.customLessons || [])]
      }), DEFAULT_STORE);
      resetAddDraft(); ctx.refresh?.(); ctx.render();
    };
  }
}