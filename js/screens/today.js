import { getStore } from '../core/store.js';
import { getLevel } from '../core/nav.js';
import { getSummary, getLastStudiedSkill, getLessonProgress } from '../core/progress.js';
import { getBookSource, renderBookDropdown, bindBookDropdown } from '../core/bookSwitch.js';
import { romajiToContextKana, isKanaMatch, toHiraganaChar } from '../core/kana.js';
import { speakJP } from '../core/tts.js';
import { escapeHtml } from '../core/util.js';

const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

const SKILL_META = {
  vocab: { name: 'Từ vựng', icon: '語', accent: 'accent-teal', smWeeks: [4, 5, 6] },
  kanji: { name: 'Kanji', icon: '漢', accent: 'accent-yellow', smWeeks: [1, 2, 3] },
  grammar: { name: 'Ngữ pháp', icon: '文', accent: 'accent-coral', smWeeks: [1, 2, 3, 4] }
};

function getSomatomeDays(level, skill, weeks) {
  const storeKey = skill === 'kanji' ? 'kanji' : 'vocab';
  const custom = getStore(storeKey, { customLessons: [] })?.customLessons || [];
  const foundMap = new Map();

  custom.forEach((cl) => {
    const m = String(cl.name || '').match(/Tuần\s*([1-6])\s*[-–—]\s*Ngày\s*([1-6])/i);
    if (m && weeks.includes(Number(m[1]))) {
      foundMap.set(`${Number(m[1])}-${Number(m[2])}`, cl);
    }
  });

  const list = [];
  weeks.forEach((w) => {
    for (let d = 1; d <= 6; d++) {
      const cl = foundMap.get(`${w}-${d}`);
      const prog = cl ? (getLessonProgress(level, skill, cl.id) || {}) : {};
      list.push({
        skill,
        week: w,
        day: d,
        name: `Tuần ${w} - Ngày ${d}`,
        lessonId: cl ? cl.id : null,
        words: cl?.words || [],
        status: cl ? (prog.status === 'done' ? 'done' : prog.status === 'learning' ? 'learning' : 'none') : 'unloaded'
      });
    }
  });
  return list;
}

export async function mount(container) {
  const lv = getLevel();
  const lvLower = lv.toLowerCase();
  const lastSkill = getLastStudiedSkill(lv);
  const preferredSkill = SKILL_META[lastSkill] ? lastSkill : 'kanji';

  let indexCache = null;
  let warmupWord = null;
  let warmupVal = '';
  let warmupOk = false;

  const pickWarmupWord = (pool) => {
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (warmupWord && next.jp === warmupWord.jp) {
      next = pool[(pool.indexOf(next) + 1) % pool.length];
    }
    return next;
  };

  async function ensureIndexData() {
    if (indexCache) return indexCache;
    try {
      const [vRes, kRes, gRes] = await Promise.all([
        fetch(`data/${lvLower}/vocab/index.json`),
        fetch(`data/${lvLower}/kanji/index.json`),
        fetch(`data/${lvLower}/grammar/index.json`)
      ]);
      const vList = vRes.ok ? ((await vRes.json())?.lessons || []).map((l) => ({ id: l.id, name: cleanName(l.name) })) : [];
      const kList = kRes.ok ? ((await kRes.json())?.lessons || []).map((l) => ({ id: l.id, name: cleanName(l.name) })) : [];
      const gList = gRes.ok ? ((await gRes.json())?.lessons || []).map((l) => ({ id: l.id, name: cleanName(l.name), count: l.count || 0 })) : [];
      indexCache = { vocab: vList, kanji: kList, grammar: gList };
    } catch {
      indexCache = { vocab: [], kanji: [], grammar: [] };
    }
    return indexCache;
  }

  async function render() {
    const isSomatome = getBookSource() === 'somatome';
    const weakKanji = getStore('kanji', { weakWords: [] })?.weakWords || [];
    const weakVocab = getStore('vocab', { weakWords: [] })?.weakWords || [];
    const totalWeak = weakKanji.length + weakVocab.length;
    const weakSkill = weakKanji.length >= weakVocab.length ? 'kanji' : 'vocab';
    const idxData = await ensureIndexData();

    const smKanjiDays = getSomatomeDays(lv, 'kanji', [1, 2, 3]);
    const smVocabDays = getSomatomeDays(lv, 'vocab', [4, 5, 6]);
    const smGrammarDays = (idxData.grammar || []).map((g) => {
      const prog = getLessonProgress(lv, 'grammar', g.id) || {};
      return {
        skill: 'grammar',
        name: g.name,
        lessonId: g.id,
        words: [],
        count: g.count,
        status: prog.status === 'done' ? 'done' : prog.status === 'learning' ? 'learning' : 'none'
      };
    });
    const allSmWords = [...smKanjiDays, ...smVocabDays].flatMap((d) => d.words);

    if (!warmupWord) {
      const fallbackPool = allSmWords.length ? allSmWords : [...weakKanji, ...weakVocab];
      warmupWord = pickWarmupWord(fallbackPool);
    }

    let overviewCardHtml = '';
    let nextCardHtml = '';

    if (isSomatome) {
      const kDone = smKanjiDays.filter((d) => d.status === 'done').length;
      const vDone = smVocabDays.filter((d) => d.status === 'done').length;
      const gDone = smGrammarDays.filter((d) => d.status === 'done').length;
      const kLoaded = smKanjiDays.filter((d) => d.status !== 'unloaded').length;
      const vLoaded = smVocabDays.filter((d) => d.status !== 'unloaded').length;
      const totalSlots = 36 + smGrammarDays.length;
      const totalPct = totalSlots > 0 ? Math.round(((kDone + vDone + gDone) / totalSlots) * 100) : 0;
      const grSub = smGrammarDays.length ? ` • Ngữ pháp: ${gDone}/${smGrammarDays.length} bài qua` : '';

      overviewCardHtml = `
        <div class="card col gap-8">
          <div class="row-between">
            <div>
              <div class="module-sub">Giáo trình đang theo</div>
              <div class="module-title">Sou-matome ${lv} • Cuốn 1</div>
            </div>
            <span class="badge badge-ready">${totalPct}%</span>
          </div>
          <div class="text-sm text-muted">Kanji (T1–3): ${kDone}/18 qua (${kLoaded} đã nạp) • Từ vựng (T4–6): ${vDone}/18 qua (${vLoaded} đã nạp)${grSub}</div>
          <div class="w-full prg-track"><div class="prg-fill" style="--p:${totalPct}"></div></div>
        </div>`;

      const orderedDays = preferredSkill === 'grammar'
        ? [...smGrammarDays, ...smKanjiDays, ...smVocabDays]
        : preferredSkill === 'vocab'
          ? [...smVocabDays, ...smGrammarDays, ...smKanjiDays]
          : [...smKanjiDays, ...smGrammarDays, ...smVocabDays];

      const nextLoaded = orderedDays.find((d) => d.status === 'learning')
        || orderedDays.find((d) => d.status === 'none');
      const nextUnloaded = orderedDays.find((d) => d.status === 'unloaded');

      if (nextLoaded) {
        const skLabel = SKILL_META[nextLoaded.skill]?.name || 'Từ vựng';
        const idEnc = encodeURIComponent(nextLoaded.lessonId);
        const countLabel = nextLoaded.skill === 'grammar' ? `${nextLoaded.count || 0} mục` : `${nextLoaded.words.length} từ`;
        const actionsHtml = nextLoaded.skill === 'grammar'
          ? `<a href="#/${lvLower}/grammar?lesson=${idEnc}" class="btn btn-teal w-full">📖 Học & Luyện tập →</a>`
          : `<div class="grid-2">
              <a href="#/${lvLower}/${nextLoaded.skill}?lesson=${idEnc}" class="btn">⌨️ Học ngay</a>
              <a href="#/${lvLower}/${nextLoaded.skill}?gate=${idEnc}" class="btn btn-teal">✅ Kiểm tra</a>
            </div>`;
        nextCardHtml = `
          <div class="card col">
            <div class="row-between">
              <div>
                <div class="module-sub">Bài tiếp theo • ${skLabel} (${lv})</div>
                <div class="module-title">${escapeHtml(nextLoaded.name)} <span class="text-sm text-muted">(${countLabel})</span></div>
              </div>
              <span class="badge ${nextLoaded.status === 'learning' ? 'st-learning' : 'st-none'}">
                ${nextLoaded.status === 'learning' ? 'Đang học' : 'Sẵn sàng'}
              </span>
            </div>
            ${actionsHtml}
          </div>`;
      } else if (nextUnloaded) {
        const skLabel = nextUnloaded.skill === 'kanji' ? 'Kanji' : 'Từ vựng';
        nextCardHtml = `
          <div class="card col">
            <div class="row-between">
              <div>
                <div class="module-sub">Mục tiêu kế tiếp • ${skLabel}</div>
                <div class="module-title">${escapeHtml(nextUnloaded.name)}</div>
              </div>
              <span class="badge st-none">Chưa nạp</span>
            </div>
            <a href="#/${lvLower}/${nextUnloaded.skill}" class="btn btn-yellow w-full">＋ Mở sách nạp ${escapeHtml(nextUnloaded.name)} →</a>
          </div>`;
      } else {
        nextCardHtml = `
          <div class="card row-between">
            <div>
              <div class="module-sub">Sou-matome ${lv}</div>
              <div class="module-title">Hoàn thành toàn bộ bài đã nạp! 🎉</div>
            </div>
            <span class="badge st-done">${totalSlots}/${totalSlots}</span>
          </div>`;
      }
    } else {
      const meta = SKILL_META[preferredSkill];
      const summary = getSummary(lv, preferredSkill, idxData[preferredSkill] || []);
      const nextItem = summary.items.find((it) => it.status !== 'done');
      const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

      overviewCardHtml = `
        <div class="card col gap-8">
          <div class="row-between">
            <div>
              <div class="module-sub">Giáo trình đang theo</div>
              <div class="module-title">Giáo trình Riki ${lv}</div>
            </div>
            <span class="badge badge-ready">${summary.done}/${summary.total} bài</span>
          </div>
          <div class="w-full prg-track"><div class="prg-fill" style="--p:${pct}"></div></div>
        </div>`;

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
        const actionsHtml = preferredSkill === 'grammar'
          ? `<a href="#/${lvLower}/grammar?lesson=${idEnc}" class="btn btn-teal w-full">📖 Học & Luyện tập →</a>`
          : `<div class="grid-2">
              <a href="#/${lvLower}/${preferredSkill}?lesson=${idEnc}" class="btn">📖 Học</a>
              <a href="#/${lvLower}/${preferredSkill}?gate=${idEnc}" class="btn btn-teal">✅ Kiểm tra</a>
            </div>`;
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
            ${actionsHtml}
          </div>`;
      }
    }

    const warmupCardHtml = warmupWord ? `
      <div class="card col gap-8" style="border-color:${warmupOk ? 'var(--teal)' : 'var(--border)'};">
        <div class="row-between">
          <span class="module-sub">⌨️ Khởi động gõ nhanh</span>
          <div class="row gap-4">
            <button type="button" id="td-wm-speak" class="btn btn-sm" title="Nghe phát âm">🔊</button>
            <button type="button" id="td-wm-next" class="btn btn-sm">↻ Từ khác</button>
          </div>
        </div>
        <div class="row-between" style="gap:10px;">
          <div>
            <div class="jp" style="font-size:1.55rem;font-weight:800;line-height:1.2;">${escapeHtml(warmupWord.jp)}</div>
            <div class="text-sm text-muted">${escapeHtml(warmupWord.vi)}</div>
          </div>
          <input
            type="text"
            id="td-wm-inp"
            class="inp jp"
            value="${escapeHtml(warmupVal)}"
            placeholder="Gõ cách đọc..."
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            style="max-width:170px;text-align:center;${warmupOk ? 'border-color:var(--teal);color:var(--teal);font-weight:700;' : ''}"
          />
        </div>
      </div>` : `
      <a href="#/${lvLower}/${preferredSkill}" class="card module-card is-active">
        <div class="module-left">
          <div class="module-icon accent-yellow">⌨️</div>
          <div>
            <div class="module-title">Luyện gõ Kanji & Từ vựng</div>
            <div class="module-sub">Nạp từ trong sách để bật khởi động nhanh</div>
          </div>
        </div>
        <span class="badge badge-ready">Mở →</span>
      </a>`;

    container.innerHTML = `
      <div class="row-between mb-12">
        <h1 class="page-title" style="margin:0;">Hôm nay</h1>
        ${renderBookDropdown('td-book-dd')}
      </div>
      <div class="module-grid">
        ${overviewCardHtml}
        ${nextCardHtml}
        <div class="card row-between">
          <div>
            <div class="module-title">Từ cần ôn lại: ${totalWeak} từ</div>
            <div class="module-sub">Tự lưu khi làm sai hoặc đánh dấu</div>
          </div>
          <button type="button" id="today-weak-btn" class="btn btn-coral" ${totalWeak === 0 ? 'disabled' : ''}>
            ▶ Ôn ngay
          </button>
        </div>
        ${warmupCardHtml}
      </div>`;

    bindBookDropdown(container, () => render(), 'td-book-dd');

    const weakBtn = container.querySelector('#today-weak-btn');
    if (weakBtn && totalWeak > 0) {
      weakBtn.onclick = () => { window.location.hash = `#/${lvLower}/${weakSkill}?view=study-weak`; };
    }

    const wmInp = container.querySelector('#td-wm-inp');
    if (wmInp && warmupWord) {
      const target = warmupWord.reading || warmupWord.jp || '';
      wmInp.oninput = (e) => {
        if (e.isComposing && !/^[a-zA-Z0-9\u3040-\u309F'-]+$/.test(wmInp.value)) {
          warmupVal = wmInp.value;
          return;
        }
        if (/[a-zA-Z'-]/.test(wmInp.value)) {
          const conv = toHiraganaChar(romajiToContextKana(wmInp.value, false, target));
          if (conv !== wmInp.value) wmInp.value = conv;
        }
        warmupVal = wmInp.value;
        const flushed = toHiraganaChar(romajiToContextKana(warmupVal, true, target));
        if (!warmupOk && (flushed.trim() === warmupWord.jp || isKanaMatch(flushed, warmupWord, { includeJp: true }))) {
          warmupVal = flushed;
          warmupOk = true;
          speakJP(target);
          render();
        }
      };

      container.querySelector('#td-wm-speak')?.addEventListener('click', () => speakJP(target));
      container.querySelector('#td-wm-next')?.addEventListener('click', () => {
        const pool = allSmWords.length ? allSmWords : [...weakKanji, ...weakVocab];
        warmupWord = pickWarmupWord(pool);
        warmupVal = '';
        warmupOk = false;
        render();
        container.querySelector('#td-wm-inp')?.focus();
      });
    }
  }

  await render();
}