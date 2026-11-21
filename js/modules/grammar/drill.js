import { setSession } from '../../core/nav.js';
import { parseRuby, stripRuby } from '../../core/ruby.js';
import { romajiToContextKana, toHiraganaChar } from '../../core/kana.js';
import { escapeHtml } from '../../core/util.js';
import { renderExerciseCard, bindExerciseEvents } from './exercises.js';
import { recordGrammarResult } from './state.js';
import { attachSelectionLookup } from './lookup.js';

const bankCache = new Map();

export const CLUSTERS = [
  { id: 'c-time', title: 'Mốc thời gian & Tần suất', desc: '～に（割合）・～も・～ずつ・～まで vs ～までに', patIds: ['g1-2', 'g1-3', 'g1-4', 'g3-1'] },
  { id: 'c-limit', title: 'Giới hạn & Mức độ', desc: '～ほど～ない・～でも・～しか～ない・Nも・～ばかり', patIds: ['g1-5', 'g2-1', 'g2-2', 'g2-4', 'g3-4'] },
  { id: 'c-moment', title: 'Thời điểm & Khoảng thời gian', desc: '～ところ・～間に・～とき・～中（ちゅう/じゅう）', patIds: ['g4-1', 'g4-2', 'g4-3', 'g4-4'] },
  { id: 'c-state', title: 'Trạng thái & Hành động song song', desc: '～たり～たり・～ながら・～て / ～ないで・～まま', patIds: ['g3-2', 'g5-1', 'g5-3', 'g5-4'] },
  { id: 'c-reason', title: 'Nguyên nhân, Chất liệu & Liệt kê', desc: '～から / ～で・～し、～し・～て / ～で（lý do）', patIds: ['g1-1', 'g2-3', 'g3-3', 'g5-2'] },
  { id: 'c-change', title: 'Kinh nghiệm, Thay đổi & Quyết định', desc: '～ことがある・～ことにする / なる・Aく/に する・なる', patIds: ['g6-1', 'g6-2', 'g6-3', 'g6-4', 'g6-5'] }
];

const PAT_KEYWORDS = {
  'g1-1': ['から', 'つとめ', '働'], 'g1-2': ['回', '通って'], 'g1-3': ['時間'],
  'g1-4': ['ずつ'], 'g1-5': ['ほど'], 'g1-6': ['本', 'バッグ'],
  'g2-1': ['でも'], 'g2-2': ['しか'], 'g2-3': ['円', '地震'],
  'g2-4': ['も'], 'g2-5': ['とか'], 'g3-1': ['まで'],
  'g3-2': ['たり'], 'g3-3': ['し'], 'g3-4': ['ばかり'],
  'g4-1': ['ところ'], 'g4-2': ['あいだ', '間'], 'g4-3': ['とき'],
  'g4-4': ['ちゅう', 'じゅう'], 'g5-1': ['ながら'], 'g5-2': ['て', 'で'],
  'g5-3': ['ないで'], 'g5-4': ['まま'], 'g6-1': ['ことがあり', 'ことがあ'],
  'g6-2': ['こと'], 'g6-3': ['にし', 'ことにし'], 'g6-4': ['になり', 'ことになり'],
  'g6-5': ['く', 'に']
};

export function normalizeQuery(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return { raw: '', kana: '' };
  const kana = /[a-z]/i.test(s) ? toHiraganaChar(romajiToContextKana(s, true, '')).toLowerCase() : s;
  return { raw: s, kana };
}

function shuffleArr(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareExercise(ex) {
  if (ex.type !== 'choice' || !Array.isArray(ex.choices)) return { ...ex };
  const order = shuffleArr(ex.choices.map((_, i) => i));
  return {
    ...ex,
    choices: order.map((i) => ex.choices[i]),
    answer: order.indexOf(ex.answer)
  };
}

export async function loadPatternBank(level, lessons = []) {
  const lv = String(level || 'N4').toLowerCase();
  if (bankCache.has(lv)) return bankCache.get(lv);

  const dayLessons = lessons.filter((l) => l.type !== 'weekly_test');
  const [lessonFiles, rikiData] = await Promise.all([
    Promise.all(dayLessons.map((l) => fetch(`data/${lv}/grammar/${l.file}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))),
    fetch(`data/${lv}/grammar/riki-bank.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]);

  const patterns = [];
  const exByPat = new Map();
  const allMap = new Map();
  const pushEx = (patId, ex, srcLabel) => {
    if (!patId || !ex) return;
    const item = { ...ex, patternId: patId, _source: ex.source || srcLabel };
    if (!exByPat.has(patId)) exByPat.set(patId, []);
    exByPat.get(patId).push(item);
    if (item.id) allMap.set(item.id, item);
  };

  (rikiData?.exercises || []).forEach((ex) => pushEx(ex.patternId, ex, 'Luyện tập'));

  lessonFiles.forEach((data, idx) => {
    if (!data) return;
    const meta = dayLessons[idx];
    const items = data.items || [];
    const allEx = [...(data.exercises || []), ...(data.extraExercises || [])];

    items.forEach((it) => {
      const plainPat = stripRuby(it.pattern || '');
      const searchBlob = `${plainPat} ${it.formation || ''} ${it.vi || ''}`.toLowerCase();
      patterns.push({ ...it, plainPattern: plainPat, lessonId: meta.id, lessonName: meta.name, searchBlob });

      const kws = PAT_KEYWORDS[it.id] || [];
      allEx.forEach((ex) => {
        if (ex.patternId === it.id) {
          pushEx(it.id, ex, meta.name);
          return;
        }
        const ansText = Array.isArray(ex.choices) && typeof ex.answer === 'number' ? stripRuby(ex.choices[ex.answer] || '') : '';
        const qText = stripRuby(ex.q || `${ex.prefix || ''}${ex.suffix || ''}`);
        if (kws.some((kw) => ansText.includes(kw) || (ex.type === 'star' && qText.includes(kw)))) {
          pushEx(it.id, ex, meta.name);
        }
      });
    });
  });

  const result = { patterns, exByPat, allExercises: [...allMap.values()] };
  bankCache.set(lv, result);
  return result;
}

export function mountDrill(container, { level, title, subtitle, pool, limit = 10, backHash }) {
  setSession(true);
  attachSelectionLookup(container, level);

  let questions = [];
  let states = [];

  function drawSet() {
    const picked = limit > 0 ? shuffleArr(pool).slice(0, limit) : shuffleArr(pool);
    questions = picked.map(prepareExercise);
    states = questions.map(() => ({}));
  }

  function render() {
    const doneCnt = states.filter((s) => s.done).length;
    const rightCnt = states.filter((s) => s.correct).length;
    const cardsHtml = questions.map((ex, i) =>
      renderExerciseCard(ex, i, states[i], { tag: ex._source || 'Trắc nghiệm' })
    ).join('');

    container.innerHTML = `
      <div class="gr-wrap">
        <div class="gr-top">
          <a href="${backHash}" class="btn gr-pill">← Quay lại</a>
          <h1 class="gr-top-title">Luyện tập trộn</h1>
          <button type="button" id="gr-drill-reshuffle" class="btn gr-pill">↻ Đổi đề</button>
        </div>

        <section class="card gr-hero">
          <div class="gr-q-meta">
            <span class="badge badge-ready">Kho ${pool.length} câu</span>
            <span>${doneCnt}/${questions.length} câu${doneCnt ? ` • Đúng ${rightCnt}` : ''}</span>
          </div>
          <div class="gr-pat-name">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="gr-pat-vi">${escapeHtml(subtitle)}</div>` : ''}
        </section>

        <div id="gr-drill-box" class="gr-ex-list">
          ${cardsHtml || '<div class="card"><p class="module-sub">Chưa có câu hỏi nào trong mục này.</p></div>'}
        </div>
      </div>
    `;

    container.querySelector('#gr-drill-reshuffle').onclick = () => {
      drawSet();
      render();
    };
    container.querySelectorAll('ruby').forEach((rb) => {
      if (rb.closest('button, a')) return;
      rb.onclick = (e) => { e.stopPropagation(); rb.classList.toggle('is-peek'); };
    });

    const box = container.querySelector('#gr-drill-box');
    bindExerciseEvents(box, questions, states, (idx) => {
      const ex = questions[idx];
      const st = states[idx];
      if (st?.done) recordGrammarResult(ex.id, st.correct);
      render();
    });
  }

  drawSet();
  render();
}