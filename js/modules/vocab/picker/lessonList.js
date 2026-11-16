import { getLessonProgress } from '../../../core/progress.js';
import { shuffle, escapeHtml } from '../../../core/util.js';
import { fetchWords, sampleBalanced } from './data.js';

let mixFromIdx = 0;
let mixToIdx = 4;

export function renderList(container, ctx) {
  const { lessons, activeLevel, vocabSession, state, ensureDistractorPool, launchGate, render } = ctx;
  const personal = lessons.filter((l) => l.source === 'local');
  const textbook = lessons.filter((l) => l.source === 'repo');

  const localBtn = (l) => `
    <button type="button" class="card v-item pk-local-btn" data-id="${escapeHtml(l.id)}">
      <span class="pk-item-title">${escapeHtml(l.name)}</span>
      <span class="badge ${l.id === 'user:weak' ? '' : 'badge-ready'}">${l.count} từ →</span>
    </button>`;

  const repoRow = (l) => {
    const prog = getLessonProgress(activeLevel, 'vocab', l.id);
    const stCls = prog?.status === 'done' ? 'st-done' : prog?.status === 'learning' ? 'st-learning' : 'st-none';
    const stTxt = prog?.status === 'done' ? 'Đã qua ✅' : prog?.status === 'learning' ? 'Đang học' : 'Chưa học';
    return `
      <div class="card v-row">
        <button type="button" class="v-item v-row-main" data-id="${escapeHtml(l.id)}">
          <div>
            <div class="pk-item-title">${escapeHtml(l.name)}</div>
            <div class="pk-item-meta">
              <span class="badge ${stCls}">${stTxt}</span>
              <span class="pk-item-count">${l.count} từ</span>
            </div>
          </div>
        </button>
        <button type="button" class="btn btn-teal v-gate-btn" data-gate="${escapeHtml(l.id)}">Kiểm tra qua bài</button>
      </div>`;
  };

  container.innerHTML = `
    <div class="row-between mb-12">
      <a href="#/learn" class="btn">← Đổi cấp</a>
      <div class="row">
        <span class="badge badge-ready pk-lv-badge">JLPT ${escapeHtml(activeLevel)}</span>
        <button type="button" id="v-add" class="btn btn-yellow">＋ Thêm từ</button>
      </div>
    </div>
    <div class="module-grid pk-quick-grid">
      <button type="button" id="v-open-mix" class="card module-card is-active pk-card-teal">
        <div class="module-left">
          <div class="module-icon accent-teal">🔀</div>
          <div><div class="module-title">Ôn tổng hợp ${escapeHtml(activeLevel)}</div><div class="module-sub">Chọn nhanh khoảng bài & trộn ngẫu nhiên</div></div>
        </div>
        <span class="badge badge-ready">Chọn →</span>
      </button>
      <button type="button" id="v-open-kanji" class="card module-card is-active pk-card-yellow">
        <div class="module-left">
          <div class="module-icon accent-yellow">漢</div>
          <div><div class="module-title">Luyện đọc Kanji ${escapeHtml(activeLevel)}</div><div class="module-sub">Nhìn chữ Hán đọc Hiragana • Trắc nghiệm & Tự gõ</div></div>
        </div>
        <span class="badge badge-ready pk-badge-yellow">Luyện →</span>
      </button>
    </div>
    ${personal.length ? `<div class="pk-sec-lbl pk-sec-personal">Cá nhân</div><div class="module-grid pk-personal-grid">${personal.map(localBtn).join('')}</div>` : ''}
    <div class="pk-sec-lbl mb-8">Giáo trình ${escapeHtml(activeLevel)}</div>
    <div class="module-grid">${textbook.length ? textbook.map(repoRow).join('') : `<p class="module-sub">Chưa có bài học cho trình độ này.</p>`}</div>
  `;

  container.querySelector('#v-add').onclick = () => { state.impTab = 'upload'; state.step = 'importer'; render(); };
  container.querySelector('#v-open-mix').onclick = () => { state.errMsg = ''; state.mixDirectMode = null; state.step = 'mix'; render(); };
  container.querySelector('#v-open-kanji').onclick = () => { state.errMsg = ''; state.mixDirectMode = 'kanji-read'; state.step = 'mix'; render(); };
  container.querySelectorAll('.v-item').forEach((btn) => {
    btn.onclick = async () => {
      const l = lessons.find((x) => x.id === btn.dataset.id);
      if (!l) return;
      btn.disabled = true;
      state.weakDirect = l.id === 'user:weak';
      if (state.weakDirect) await ensureDistractorPool();
      const words = shuffle(await fetchWords(l, activeLevel));
      if (!words.length) { btn.disabled = false; return; }
      vocabSession.words = words; vocabSession.lessonIds = [l.id]; vocabSession.lessonNames = [l.name];
      state.mixDirectMode = null; state.step = state.weakDirect ? 'quiz' : 'modes'; render();
    };
  });
  container.querySelectorAll('.v-gate-btn').forEach((btn) => {
    btn.onclick = async () => {
      const l = lessons.find((x) => x.id === btn.dataset.gate);
      if (!l) return;
      btn.disabled = true;
      await launchGate(l);
    };
  });
}

export function renderMix(container, ctx) {
  const { lessons, selectedSet, activeLevel, vocabSession, state, saveSel, render } = ctx;
  const isKanjiDirect = state.mixDirectMode === 'kanji-read';
  const repoList = lessons.filter((l) => l.source === 'repo');
  const localList = lessons.filter((l) => l.source === 'local');
  const picked = lessons.filter((l) => selectedSet.has(l.id));
  const totalAvail = picked.reduce((s, l) => s + l.count, 0);
  const effectiveLimit = state.useAllWords || state.wordLimit >= totalAvail ? totalAvail : state.wordLimit;

  const maxIdx = Math.max(0, repoList.length - 1);
  const safeFrom = Math.min(mixFromIdx, maxIdx);
  const safeTo = Math.min(mixToIdx, maxIdx);
  const fromOpts = repoList.map((l, idx) => `<option value="${idx}" ${idx === safeFrom ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('');
  const toOpts = repoList.map((l, idx) => `<option value="${idx}" ${idx === safeTo ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('');

  const pillsHtml = repoList.map((l) => {
    const on = selectedSet.has(l.id);
    return `<button type="button" class="mix-pill pk-pill ${on ? 'is-on' : ''}" data-id="${escapeHtml(l.id)}">${escapeHtml(l.name.replace(/^Bài\s*/i, ''))}</button>`;
  }).join('');
  const localHtml = localList.map((l) => {
    const on = selectedSet.has(l.id);
    return `<button type="button" class="mix-pill pk-local-pill ${on ? 'is-on' : ''}" data-id="${escapeHtml(l.id)}">${escapeHtml(l.name)} (${l.count})</button>`;
  }).join('');

  container.innerHTML = `
    <div class="row-between mb-12">
      <button type="button" id="mix-back" class="btn">← Danh sách ${escapeHtml(activeLevel)}</button>
      <div class="row pk-mix-tools">
        <button type="button" id="mix-all" class="btn pk-tool-btn">Chọn hết</button>
        <button type="button" id="mix-none" class="btn pk-tool-btn">Bỏ chọn</button>
      </div>
    </div>
    <div class="card col mb-12">
      <div class="module-title">${isKanjiDirect ? `Chọn bài luyện đọc Kanji (${escapeHtml(activeLevel)})` : `Chọn nhanh khoảng bài (${escapeHtml(activeLevel)})`}</div>
      ${repoList.length ? `<div class="pk-rng-row"><select id="rng-from" class="pk-rng-sel">${fromOpts}</select><span class="pk-rng-arrow">→</span><select id="rng-to" class="pk-rng-sel">${toOpts}</select><button type="button" id="rng-apply" class="btn btn-teal pk-rng-btn">Áp dụng</button></div><div class="pk-grid-4">${pillsHtml}</div>` : ''}
      ${localList.length ? `<div class="pk-local-pills">${localHtml}</div>` : ''}
    </div>
    <div class="card col">
      <div class="row-between"><span class="pk-bold">${isKanjiDirect ? 'Số từ lấy để lọc Kanji' : 'Số từ muốn ôn'}</span><span class="badge badge-ready">Đã chọn ${picked.length} bài (${totalAvail} từ)</span></div>
      <div class="pk-grid-4">
        ${[15, 30, 50].map((n) => `<button type="button" class="btn mix-lim pk-lim-btn ${!state.useAllWords && state.wordLimit === n ? 'btn-teal' : ''}" data-n="${n}">${n} từ</button>`).join('')}
        <button type="button" id="mix-lim-all" class="btn pk-lim-btn ${state.useAllWords ? 'btn-yellow' : ''}">Ôn hết</button>
      </div>
      ${state.errMsg ? `<p class="pk-err">${escapeHtml(state.errMsg)}</p>` : ''}
      <button type="button" id="mix-go" class="btn ${isKanjiDirect ? 'btn-yellow' : 'btn-teal'} w-full pk-go-btn" ${!picked.length || state.loading ? 'disabled' : ''}>${state.loading ? 'Đang tải dữ liệu...' : isKanjiDirect ? `Bắt đầu luyện đọc Kanji →` : `Bắt đầu ôn ${effectiveLimit} từ →`}</button>
    </div>`;

  container.querySelector('#mix-back').onclick = () => { state.mixDirectMode = null; state.step = 'list'; render(); };
  container.querySelector('#mix-all').onclick = () => { lessons.forEach((l) => selectedSet.add(l.id)); saveSel(); renderMix(container, ctx); };
  container.querySelector('#mix-none').onclick = () => { selectedSet.clear(); saveSel(); renderMix(container, ctx); };
  container.querySelector('#rng-from')?.addEventListener('change', (e) => { mixFromIdx = Number(e.target.value); });
  container.querySelector('#rng-to')?.addEventListener('change', (e) => { mixToIdx = Number(e.target.value); });
  container.querySelector('#rng-apply')?.addEventListener('click', () => {
    const a = Number(container.querySelector('#rng-from').value), b = Number(container.querySelector('#rng-to').value);
    mixFromIdx = a;
    mixToIdx = b;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    selectedSet.clear(); for (let i = lo; i <= hi; i++) selectedSet.add(repoList[i].id);
    saveSel(); renderMix(container, ctx);
  });
  container.querySelectorAll('.mix-pill').forEach((b) => { b.onclick = () => { const id = b.dataset.id; selectedSet.has(id) ? selectedSet.delete(id) : selectedSet.add(id); saveSel(); renderMix(container, ctx); }; });
  container.querySelectorAll('.mix-lim').forEach((b) => { b.onclick = () => { state.useAllWords = false; state.wordLimit = Number(b.dataset.n); renderMix(container, ctx); }; });
  container.querySelector('#mix-lim-all').onclick = () => { state.useAllWords = true; renderMix(container, ctx); };
  container.querySelector('#mix-go').onclick = async () => {
    if (!picked.length) return;
    state.loading = true; state.errMsg = ''; renderMix(container, ctx);
    const buckets = await Promise.all(picked.map((item) => fetchWords(item, activeLevel)));
    state.loading = false;
    const mixed = sampleBalanced(buckets, state.useAllWords ? 0 : state.wordLimit);
    if (!mixed.length) { state.errMsg = 'Các bài đã chọn chưa có dữ liệu từ vựng.'; renderMix(container, ctx); return; }
    vocabSession.words = mixed;
    vocabSession.lessonIds = picked.map((l) => l.id);
    vocabSession.lessonNames = [`Tổng hợp ${picked.length} bài (${mixed.length} từ)`];
    state.weakDirect = false;
    state.step = state.mixDirectMode || 'modes';
    render();
  };
}