import { getStore, updateStore } from '../../core/store.js';
import { getLevel, setSession } from '../../core/nav.js';
import { getLessonProgress, markStudied } from '../../core/progress.js';
import { shuffle, escapeHtml } from '../../core/util.js';
import { getWeak } from '../../core/weak.js';
import { mountFlashcard } from './flashcard.js';
import { mountImporter } from './importer.js';
import { mountQuiz } from './quiz.js';
import { mountMatch } from './match.js';
import { mountReflex } from './reflex.js';
import { mountKanjiRead } from './kanji-read.js';

export const meta = { id: 'vocab', name: 'Từ vựng', icon: '語' };
export const vocabSession = { words: [], lessonIds: [], lessonNames: [] };
let mixFromIdx = 0;
let mixToIdx = 4;
const STORE_KEY = 'vocab';
const DEFAULT_STORE = { selectedIds: [], customLessons: [], openWords: [], weakWords: [] };
const MODES = [
  { id: 'flashcard', name: 'Học từ mới', sub: 'Lật thẻ Flashcard & nghe phát âm', icon: '🃏', accent: 'accent-teal' },
  { id: 'kanji-read', name: 'Đọc Kanji', sub: 'Nhìn chữ Hán chọn cách đọc Hiragana & bẫy biến âm', icon: '漢', accent: 'accent-yellow' },
  { id: 'match', name: 'Trò chơi ghép thẻ', sub: 'Nối nhanh từ tiếng Nhật và nghĩa theo đồng hồ', icon: '🧩', accent: 'accent-yellow' },
  { id: 'quiz', name: 'Kiểm tra', sub: 'Trắc nghiệm, Đúng/Sai, Nối cặp & lưu từ cần ôn', icon: '📝', accent: 'accent-coral' },
  { id: 'reflex', name: 'Luyện phản xạ', sub: 'Nghe hiểu & Thử thách tốc độ 5 giây/câu', icon: '⚡', accent: 'accent-teal' }
];

const repoCache = {};
async function fetchRepo(level) {
  const lv = level.toLowerCase();
  if (repoCache[lv]) return repoCache[lv];
  try {
    const res = await fetch(`data/${lv}/vocab/index.json`);
    repoCache[lv] = res.ok ? ((await res.json())?.lessons || []) : [];
  } catch { repoCache[lv] = []; }
  return repoCache[lv];
}

const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

function buildLessons(repo, st, activeLevel) {
  const list = [];
  const weakWords = getWeak();
  if (weakWords.length) list.push({ id: 'user:weak', name: '📌 Từ cần ôn lại', count: weakWords.length, words: weakWords, source: 'local' });
  if (st.openWords?.length) list.push({ id: 'user:open', name: '📖 Từ mở rộng', count: st.openWords.length, words: st.openWords, source: 'local' });
  (st.customLessons || []).forEach((cl) => {
    if (cl?.id && cl.words?.length) list.push({ id: String(cl.id), name: cleanName(cl.name || 'Bài tự thêm'), count: cl.words.length, words: cl.words, source: 'local' });
  });
  repo.forEach((l) => list.push({ id: l.id, level: activeLevel, name: cleanName(l.name), file: l.file, count: Number(l.count) || 0, source: 'repo' }));
  return list;
}

async function fetchWords(item, level) {
  if (item.source === 'local') return [...(item.words || [])];
  try {
    const res = await fetch(`data/${level.toLowerCase()}/vocab/${item.file}`);
    return res.ok ? ((await res.json())?.words || []) : [];
  } catch { return []; }
}

function sampleBalanced(buckets, limit) {
  const groups = buckets.map((b) => shuffle(b)).filter((g) => g.length);
  const total = groups.reduce((s, g) => s + g.length, 0);
  if (!limit || limit >= total) return shuffle(groups.flat());
  const out = [];
  while (out.length < limit && groups.some((g) => g.length)) {
    for (const g of groups) if (g.length && out.length < limit) out.push(g.pop());
  }
  return shuffle(out);
}

export async function mount(container, { level, query } = {}) {
  setSession(false);
  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải danh sách bài học...</p></div>`;
  const activeLevel = (level || getLevel()).toUpperCase();
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query || '');
  const viewParam = params.get('view');
  const gateParam = params.get('gate');
  const lessonParam = params.get('lesson');

  const repo = await fetchRepo(activeLevel);
  let store = getStore(STORE_KEY, DEFAULT_STORE);
  let lessons = buildLessons(repo, store, activeLevel);

  const saved = (store.selectedIds || []).filter((id) => lessons.some((l) => l.id === id));
  const selectedSet = new Set(saved.length ? saved : lessons.filter((l) => l.source === 'repo').slice(0, 2).map((l) => l.id));
  let step = 'list', impTab = 'upload', impTarget = 'user:weak', weakDirect = false, gateCfg = null;
  let mixDirectMode = null, extraPoolWords = [];
  let wordLimit = 20, useAllWords = false, loading = false, errMsg = '';

  const baseRoute = `#/${activeLevel.toLowerCase()}/vocab`;
  const backToLevel = () => { if (window.location.hash !== baseRoute) window.location.hash = baseRoute; };
  const markSelectedStudied = () => {
    (vocabSession.lessonIds || []).forEach((id) => markStudied(activeLevel, 'vocab', id));
  };

  async function ensureDistractorPool() {
    if (extraPoolWords.length >= 12) return extraPoolWords;
    const repoList = lessons.filter((l) => l.source === 'repo').slice(0, 3);
    if (!repoList.length) return [];
    const buckets = await Promise.all(repoList.map((x) => fetchWords(x, activeLevel)));
    extraPoolWords = buckets.flat();
    return extraPoolWords;
  }

  async function launchGate(lessonItem) {
    const repoList = lessons.filter((l) => l.source === 'repo');
    const idx = repoList.findIndex((x) => x.id === lessonItem.id);
    const words = await fetchWords(lessonItem, activeLevel);
    if (!words.length) { step = 'list'; render(); return; }
    let poolWords = [...words];
    if (poolWords.length < 6 && repoList.length > 1) {
      const extras = repoList.filter((x) => x.id !== lessonItem.id).slice(0, 3);
      const extraBuckets = await Promise.all(extras.map((x) => fetchWords(x, activeLevel)));
      poolWords = [...poolWords, ...extraBuckets.flat()];
    }
    const nextLesson = idx >= 0 && idx < repoList.length - 1 ? repoList[idx + 1] : null;
    gateCfg = {
      level: activeLevel,
      lessonId: lessonItem.id,
      lessonName: lessonItem.name,
      words,
      poolWords,
      nextLesson,
      onNextLesson: nextLesson ? async () => {
        const nextWords = shuffle(await fetchWords(nextLesson, activeLevel));
        gateCfg = null;
        weakDirect = false;
        mixDirectMode = null;
        if (window.location.hash.includes('gate=')) backToLevel();
        if (!nextWords.length) {
          step = 'list';
          return render();
        }
        vocabSession.words = nextWords;
        vocabSession.lessonIds = [nextLesson.id];
        vocabSession.lessonNames = [nextLesson.name];
        step = 'modes';
        render();
      } : null
    };
    step = 'gate';
    render();
  }

  if (gateParam) {
    const target = lessons.find((l) => l.source === 'repo' && String(l.id) === String(gateParam));
    if (target) return launchGate(target);
  } else if (lessonParam) {
    const target = lessons.find((l) => String(l.id) === String(lessonParam));
    if (target) {
      const words = shuffle(await fetchWords(target, activeLevel));
      if (words.length) {
        vocabSession.words = words; vocabSession.lessonIds = [target.id]; vocabSession.lessonNames = [target.name];
        weakDirect = target.id === 'user:weak';
        if (weakDirect) await ensureDistractorPool();
        step = weakDirect ? 'quiz' : 'modes';
      }
    }
  } else if (viewParam === 'study-weak' && getWeak().length) {
    await ensureDistractorPool();
    vocabSession.words = shuffle(getWeak()); vocabSession.lessonIds = []; vocabSession.lessonNames = ['Từ cần ôn lại'];
    weakDirect = true; step = 'quiz';
  } else if (viewParam === 'study-open' && store.openWords?.length) {
    vocabSession.words = shuffle(store.openWords); vocabSession.lessonIds = []; vocabSession.lessonNames = ['Từ mở rộng']; step = 'modes';
  } else if (['weak', 'open', 'manage'].includes(viewParam)) {
    step = 'importer'; impTab = 'manage'; impTarget = viewParam === 'open' ? 'user:open' : 'user:weak';
  } else if (viewParam === 'add') { step = 'importer'; impTab = 'upload'; }

  const refresh = () => {
    store = getStore(STORE_KEY, DEFAULT_STORE);
    lessons = buildLessons(repo, store, activeLevel);
    for (const id of [...selectedSet]) if (!lessons.some((l) => l.id === id)) selectedSet.delete(id);
  };
  const saveSel = () => updateStore(STORE_KEY, (c) => ({ ...c, selectedIds: [...selectedSet] }), DEFAULT_STORE);
  window.addEventListener('hashchange', () => setSession(false), { once: true });

  function render() {
    const backModes = () => {
      setSession(false); refresh();
      if (weakDirect || step === 'gate' || mixDirectMode) {
        weakDirect = false; gateCfg = null; mixDirectMode = null; backToLevel(); step = 'list';
      } else {
        step = 'modes';
      }
      render();
    };
    if (step === 'gate' && gateCfg) { setSession(true); return mountQuiz(container, gateCfg.words, backModes, { gate: gateCfg }); }
    if (step === 'flashcard') { markSelectedStudied(); setSession(true); return mountFlashcard(container, vocabSession.words, backModes); }
    if (step === 'kanji-read') { markSelectedStudied(); setSession(true); return mountKanjiRead(container, vocabSession.words, backModes); }
    if (step === 'match') { markSelectedStudied(); setSession(true); return mountMatch(container, vocabSession.words, backModes); }
    if (step === 'quiz') { markSelectedStudied(); setSession(true); return mountQuiz(container, vocabSession.words, backModes, { weakReview: weakDirect, poolWords: extraPoolWords }); }
    if (step === 'reflex') { markSelectedStudied(); setSession(true); return mountReflex(container, vocabSession.words, backModes); }
    setSession(false);
    if (step === 'importer') return mountImporter(container, () => { setSession(false); backToLevel(); refresh(); saveSel(); step = 'list'; render(); }, { tab: impTab, manageTarget: impTarget });
    if (step === 'mix') return renderMix();
    if (step === 'modes') return renderModes();
    renderList();
  }

  function renderList() {
    const personal = lessons.filter((l) => l.source === 'local');
    const textbook = lessons.filter((l) => l.source === 'repo');
    const localBtn = (l) => `
      <button type="button" class="card v-item" data-id="${escapeHtml(l.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer;text-align:left;color:var(--text);">
        <span style="font-weight:800;font-size:1.05rem;">${escapeHtml(l.name)}</span>
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
              <div style="font-weight:800;font-size:1.05rem;">${escapeHtml(l.name)}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
                <span class="badge ${stCls}">${stTxt}</span>
                <span style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">${l.count} từ</span>
              </div>
            </div>
          </button>
          <button type="button" class="btn btn-teal v-gate-btn" data-gate="${escapeHtml(l.id)}">Kiểm tra qua bài</button>
        </div>`;
    };

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <a href="#/learn" class="btn">← Đổi cấp</a>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge badge-ready" style="font-size:0.9rem;padding:6px 12px;">JLPT ${escapeHtml(activeLevel)}</span>
          <button type="button" id="v-add" class="btn btn-yellow">＋ Thêm từ</button>
        </div>
      </div>
      <div class="module-grid" style="margin-bottom:14px;">
        <button type="button" id="v-open-mix" class="card module-card is-active" style="border-color:var(--teal);">
          <div class="module-left">
            <div class="module-icon accent-teal">🔀</div>
            <div><div class="module-title">Ôn tổng hợp ${escapeHtml(activeLevel)}</div><div class="module-sub">Chọn nhanh khoảng bài & trộn ngẫu nhiên</div></div>
          </div>
          <span class="badge badge-ready">Chọn →</span>
        </button>
        <button type="button" id="v-open-kanji" class="card module-card is-active" style="border-color:var(--yellow);">
          <div class="module-left">
            <div class="module-icon accent-yellow">漢</div>
            <div><div class="module-title">Luyện đọc Kanji ${escapeHtml(activeLevel)}</div><div class="module-sub">Nhìn chữ Hán đọc Hiragana • Trắc nghiệm & Tự gõ</div></div>
          </div>
          <span class="badge badge-ready" style="background:var(--yellow);">Luyện →</span>
        </button>
      </div>
      ${personal.length ? `<div style="font-size:0.78rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin:6px 0 8px;">Cá nhân</div><div class="module-grid" style="margin-bottom:14px;">${personal.map(localBtn).join('')}</div>` : ''}
      <div style="font-size:0.78rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Giáo trình ${escapeHtml(activeLevel)}</div>
      <div class="module-grid">${textbook.length ? textbook.map(repoRow).join('') : `<p class="module-sub">Chưa có bài học cho trình độ này.</p>`}</div>
    `;

    container.querySelector('#v-add').onclick = () => { impTab = 'upload'; step = 'importer'; render(); };
    container.querySelector('#v-open-mix').onclick = () => { errMsg = ''; mixDirectMode = null; step = 'mix'; render(); };
    container.querySelector('#v-open-kanji').onclick = () => { errMsg = ''; mixDirectMode = 'kanji-read'; step = 'mix'; render(); };
    container.querySelectorAll('.v-item').forEach((btn) => {
      btn.onclick = async () => {
        const l = lessons.find((x) => x.id === btn.dataset.id);
        if (!l) return;
        btn.disabled = true;
        weakDirect = l.id === 'user:weak';
        if (weakDirect) await ensureDistractorPool();
        const words = shuffle(await fetchWords(l, activeLevel));
        if (!words.length) { btn.disabled = false; return; }
        vocabSession.words = words; vocabSession.lessonIds = [l.id]; vocabSession.lessonNames = [l.name];
        mixDirectMode = null; step = weakDirect ? 'quiz' : 'modes'; render();
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

  function renderMix() {
    const isKanjiDirect = mixDirectMode === 'kanji-read';
    const repoList = lessons.filter((l) => l.source === 'repo');
    const localList = lessons.filter((l) => l.source === 'local');
    const picked = lessons.filter((l) => selectedSet.has(l.id));
    const totalAvail = picked.reduce((s, l) => s + l.count, 0);
    const effectiveLimit = useAllWords || wordLimit >= totalAvail ? totalAvail : wordLimit;

    const maxIdx = Math.max(0, repoList.length - 1);
    const safeFrom = Math.min(mixFromIdx, maxIdx);
    const safeTo = Math.min(mixToIdx, maxIdx);
    const fromOpts = repoList.map((l, idx) => `<option value="${idx}" ${idx === safeFrom ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('');
    const toOpts = repoList.map((l, idx) => `<option value="${idx}" ${idx === safeTo ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('');

    const pillsHtml = repoList.map((l) => {
      const on = selectedSet.has(l.id);
      return `<button type="button" class="mix-pill" data-id="${escapeHtml(l.id)}" style="min-height:44px;padding:6px 4px;border-radius:12px;border:2px solid ${on ? 'var(--teal)' : 'var(--border)'};background:${on ? 'var(--teal)' : 'var(--bg-elevated)'};color:${on ? '#101320' : 'var(--text)'};font-family:var(--font-ui);font-weight:800;font-size:0.95rem;cursor:pointer;">${escapeHtml(l.name.replace(/^Bài\s*/i, ''))}</button>`;
    }).join('');
    const localHtml = localList.map((l) => {
      const on = selectedSet.has(l.id);
      return `<button type="button" class="mix-pill" data-id="${escapeHtml(l.id)}" style="min-height:44px;padding:6px 12px;border-radius:12px;border:2px solid ${on ? 'var(--yellow)' : 'var(--border)'};background:${on ? 'rgba(245,200,79,0.2)' : 'var(--bg-elevated)'};color:var(--text);font-family:var(--font-ui);font-weight:700;font-size:0.9rem;cursor:pointer;">${escapeHtml(l.name)} (${l.count})</button>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <button type="button" id="mix-back" class="btn">← Danh sách ${escapeHtml(activeLevel)}</button>
        <div style="display:flex;gap:6px;">
          <button type="button" id="mix-all" class="btn" style="padding:6px 10px;font-size:0.86rem;">Chọn hết</button>
          <button type="button" id="mix-none" class="btn" style="padding:6px 10px;font-size:0.86rem;">Bỏ chọn</button>
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px;margin-bottom:12px;">
        <div class="module-title">${isKanjiDirect ? `Chọn bài luyện đọc Kanji (${escapeHtml(activeLevel)})` : `Chọn nhanh khoảng bài (${escapeHtml(activeLevel)})`}</div>
        ${repoList.length ? `<div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:6px;align-items:center;"><select id="rng-from" style="min-height:44px;padding:6px 8px;border-radius:10px;border:2px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-ui);font-weight:700;">${fromOpts}</select><span style="color:var(--text-muted);font-weight:800;">→</span><select id="rng-to" style="min-height:44px;padding:6px 8px;border-radius:10px;border:2px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-ui);font-weight:700;">${toOpts}</select><button type="button" id="rng-apply" class="btn btn-teal" style="padding:6px 12px;">Áp dụng</button></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${pillsHtml}</div>` : ''}
        ${localList.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:6px;border-top:1.5px dashed var(--border);">${localHtml}</div>` : ''}
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:800;">${isKanjiDirect ? 'Số từ lấy để lọc Kanji' : 'Số từ muốn ôn'}</span><span class="badge badge-ready">Đã chọn ${picked.length} bài (${totalAvail} từ)</span></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          ${[15, 30, 50].map((n) => `<button type="button" class="btn mix-lim ${!useAllWords && wordLimit === n ? 'btn-teal' : ''}" data-n="${n}" style="padding:6px 4px;font-size:0.9rem;">${n} từ</button>`).join('')}
          <button type="button" id="mix-lim-all" class="btn ${useAllWords ? 'btn-yellow' : ''}" style="padding:6px 4px;font-size:0.9rem;">Ôn hết</button>
        </div>
        ${errMsg ? `<p style="color:var(--red);font-weight:700;font-size:0.9rem;">${escapeHtml(errMsg)}</p>` : ''}
        <button type="button" id="mix-go" class="btn ${isKanjiDirect ? 'btn-yellow' : 'btn-teal'}" style="width:100%;font-size:1.05rem;" ${!picked.length || loading ? 'disabled' : ''}>${loading ? 'Đang tải dữ liệu...' : isKanjiDirect ? `Bắt đầu luyện đọc Kanji →` : `Bắt đầu ôn ${effectiveLimit} từ →`}</button>
      </div>`;

    container.querySelector('#mix-back').onclick = () => { mixDirectMode = null; step = 'list'; render(); };
    container.querySelector('#mix-all').onclick = () => { lessons.forEach((l) => selectedSet.add(l.id)); saveSel(); renderMix(); };
    container.querySelector('#mix-none').onclick = () => { selectedSet.clear(); saveSel(); renderMix(); };
    container.querySelector('#rng-from')?.addEventListener('change', (e) => { mixFromIdx = Number(e.target.value); });
    container.querySelector('#rng-to')?.addEventListener('change', (e) => { mixToIdx = Number(e.target.value); });
    container.querySelector('#rng-apply')?.addEventListener('click', () => {
      const a = Number(container.querySelector('#rng-from').value), b = Number(container.querySelector('#rng-to').value);
      mixFromIdx = a;
      mixToIdx = b;
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      selectedSet.clear(); for (let i = lo; i <= hi; i++) selectedSet.add(repoList[i].id);
      saveSel(); renderMix();
    });
    container.querySelectorAll('.mix-pill').forEach((b) => { b.onclick = () => { const id = b.dataset.id; selectedSet.has(id) ? selectedSet.delete(id) : selectedSet.add(id); saveSel(); renderMix(); }; });
    container.querySelectorAll('.mix-lim').forEach((b) => { b.onclick = () => { useAllWords = false; wordLimit = Number(b.dataset.n); renderMix(); }; });
    container.querySelector('#mix-lim-all').onclick = () => { useAllWords = true; renderMix(); };
    container.querySelector('#mix-go').onclick = async () => {
      if (!picked.length) return;
      loading = true; errMsg = ''; renderMix();
      const buckets = await Promise.all(picked.map((item) => fetchWords(item, activeLevel)));
      loading = false;
      const mixed = sampleBalanced(buckets, useAllWords ? 0 : wordLimit);
      if (!mixed.length) { errMsg = 'Các bài đã chọn chưa có dữ liệu từ vựng.'; renderMix(); return; }
      vocabSession.words = mixed;
      vocabSession.lessonIds = picked.map((l) => l.id);
      vocabSession.lessonNames = [`Tổng hợp ${picked.length} bài (${mixed.length} từ)`];
      weakDirect = false;
      step = mixDirectMode || 'modes';
      render();
    };
  }

  function renderModes() {
    const singleRepoLesson = vocabSession.lessonIds?.length === 1
      ? lessons.find((l) => l.source === 'repo' && String(l.id) === String(vocabSession.lessonIds[0]))
      : null;

    const gateCardHtml = singleRepoLesson ? `
      <div class="card module-card is-active" id="m-start-gate" style="border-color:var(--teal);">
        <div class="module-left">
          <div class="module-icon accent-teal">🏆</div>
          <div>
            <div class="module-title">Kiểm tra qua bài</div>
            <div class="module-sub">Đạt từ 80% trở lên để đánh dấu đã qua ${escapeHtml(singleRepoLesson.name)}</div>
          </div>
        </div>
        <span class="badge badge-ready">Thi ngay →</span>
      </div>` : '';

    const modesHtml = MODES.map((m) => `
      <div class="card module-card is-active" data-mode="${m.id}">
        <div class="module-left"><div class="module-icon ${m.accent}">${m.icon}</div><div><div class="module-title">${m.name}</div><div class="module-sub">${m.sub}</div></div></div>
        <span class="badge badge-ready">Vào →</span>
      </div>`).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
        <button type="button" id="m-back" class="btn">← Đổi bài</button>
        <span class="badge badge-ready">${vocabSession.words.length} từ</span>
      </div>
      <div class="card" style="margin-bottom:12px;"><div class="module-title">${escapeHtml(vocabSession.lessonNames.join(', '))}</div><div class="module-sub">Chọn chế độ luyện tập bên dưới</div></div>
      <div class="module-grid">${modesHtml}${gateCardHtml}</div>`;

    container.querySelector('#m-back').onclick = () => { backToLevel(); refresh(); step = 'list'; render(); };
    container.querySelectorAll('.module-card[data-mode]').forEach((c) => { c.onclick = () => { step = c.dataset.mode; render(); }; });
    container.querySelector('#m-start-gate')?.addEventListener('click', async (e) => {
      e.currentTarget.style.pointerEvents = 'none';
      await launchGate(singleRepoLesson);
    });
  }

  render();
}