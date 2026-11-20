import { setSession } from '../../core/nav.js';
import { markStudied, recordTest } from '../../core/progress.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';
import { escapeHtml } from '../../core/util.js';
import { renderExerciseCard, bindExerciseEvents } from './exercises.js';

function renderHighlightedJp(jp, hl) {
  if (!hl || !jp.includes(hl)) return parseRuby(jp);
  const parts = jp.split(hl);
  return parts.map((p) => parseRuby(p)).join(`<mark class="gr-hl">${parseRuby(hl)}</mark>`);
}

export function mount(container, { level, meta, data, backHash }) {
  setSession(true);
  markStudied(level, 'grammar', meta.id);

  let showFuri = false;
  let showExtra = false;
  let warmPick = null;
  const collapsed = new Set();
  const baseList = data.exercises || [];
  const extraList = data.extraExercises || [];
  const baseStates = baseList.map(() => ({}));
  const extraStates = extraList.map(() => ({}));

  function renderWarmup(warm) {
    if (!warm) return '';
    const answered = warmPick !== null;
    const isRight = warmPick === warm.answer;
    const wrongMsg = !isRight && warm.wrongExplains?.[warmPick] ? `${warm.wrongExplains[warmPick]} ` : '';
    const fbText = isRight
      ? `✅ Chính xác! ${warm.explain}`
      : `❌ Chưa đúng. ${wrongMsg}👉 ${warm.explain}`;

    return `
      <section class="card gr-warm">
        <div class="gr-q-meta"><span>💡 Khởi động nhanh</span></div>
        <div class="gr-q-text jp">${parseRuby(warm.q)}</div>
        <div class="gr-warm-opts">
          ${warm.choices.map((c, i) => {
            const cls = !answered ? '' : i === warm.answer ? 'is-right' : i === warmPick ? 'is-wrong' : '';
            return `<button type="button" class="btn gr-opt ${cls}" data-warm="${i}" ${answered ? 'disabled' : ''}>${parseRuby(c)}</button>`;
          }).join('')}
        </div>
        ${answered ? `<div class="gr-exp ${isRight ? '' : 'is-err'}">${escapeHtml(fbText)}</div>` : ''}
      </section>`;
  }

  function render() {
    const patsHtml = (data.items || []).map((it) => {
      const isCol = collapsed.has(it.id);
      const exsHtml = (it.examples || []).map((ex, eIdx) => `
        <div class="gr-ex">
          <div class="gr-ex-row">
            <div class="gr-ex-jp jp">${renderHighlightedJp(ex.jp, ex.highlight)}</div>
            <button type="button" class="btn btn-icon gr-spk" data-say="${escapeHtml(ex.jp)}" aria-label="Nghe câu ${eIdx + 1}">🔊</button>
          </div>
          <div class="gr-ex-vi is-hidden" data-reveal="1">${escapeHtml(ex.vi)}</div>
        </div>`).join('');

      return `<article class="card gr-pat ${isCol ? 'is-collapsed' : ''}" data-pat="${escapeHtml(it.id)}">
        <div class="gr-pat-head" data-toggle-pat="${escapeHtml(it.id)}">
          <div>
            <div class="gr-pat-name jp">${parseRuby(it.pattern)}</div>
            ${it.formation ? `<span class="gr-pat-form">${escapeHtml(it.formation)}</span>` : ''}
          </div>
          <span class="badge">${isCol ? 'Mở ▾' : 'Thu ▴'}</span>
        </div>
        <div class="gr-pat-vi">${escapeHtml(it.vi)}</div>
        <div class="gr-pat-body">
          ${it.note ? `<div class="gr-note mb-8">⚠️ ${escapeHtml(it.note)}</div>` : ''}
          <div class="gr-ex-list">${exsHtml}</div>
        </div>
      </article>`;
    }).join('');

    const doneBase = baseStates.filter((s) => s.done).length;
    const baseExHtml = baseList.map((ex, i) => renderExerciseCard(ex, i, baseStates[i])).join('');
    const extraExHtml = showExtra
      ? extraList.map((ex, i) => renderExerciseCard(ex, i, extraStates[i], { tag: 'Luyện thêm' })).join('')
      : (extraList.length ? `<button type="button" id="gr-more-btn" class="btn btn-yellow">+ Luyện thêm ${extraList.length} câu (phủ mẫu còn lại)</button>` : '');

    container.innerHTML = `
      <div class="gr-wrap ${showFuri ? '' : 'hide-furigana'}">
        <div class="gr-top">
          <a href="${backHash}" class="btn gr-pill">← Tuần</a>
          <h1 class="gr-top-title">${escapeHtml(data.lesson?.name || meta.name)}</h1>
          <button type="button" id="gr-furi-btn" class="btn gr-pill ${showFuri ? 'is-on' : ''}">ふりがな</button>
        </div>

        <section class="card gr-hero" id="gr-sec-theory">
          <div class="gr-ex-row">
            <div>
              <span class="badge">Chủ điểm hôm nay</span>
              <div class="gr-hero-jp jp">${parseRuby(data.title || '')}</div>
            </div>
            <button type="button" class="btn btn-icon gr-spk" data-say="${escapeHtml(data.title || '')}" aria-label="Nghe tiêu đề">🔊</button>
          </div>
        </section>

        ${renderWarmup(data.warmup)}
        <div class="gr-sec-head"><h2 class="gr-sec-title">Mẫu ngữ pháp (${(data.items || []).length})</h2></div>
        ${patsHtml}

        <div class="gr-sec-head" id="gr-sec-ex">
          <h2 class="gr-sec-title">Bài tập sách (${doneBase}/${baseList.length})</h2>
        </div>
        <div id="gr-base-box" class="gr-ex-list">${baseExHtml}</div>
        <div id="gr-extra-box" class="gr-ex-list">${extraExHtml}</div>
      </div>

      <div class="gr-jump">
        <button type="button" class="btn" data-jump="gr-sec-theory">Lý thuyết</button>
        <button type="button" class="btn btn-teal" data-jump="gr-sec-ex">Bài tập ${doneBase}/${baseList.length}</button>
      </div>
    `;

    bindAll();
  }

  function bindAll() {
    container.querySelector('#gr-furi-btn').onclick = () => { showFuri = !showFuri; render(); };
    container.querySelectorAll('ruby').forEach((rb) => {
      if (rb.closest('button, a, [data-toggle-pat]')) return;
      rb.onclick = (e) => { e.stopPropagation(); rb.classList.toggle('is-peek'); };
    });
    container.querySelectorAll('[data-warm]').forEach((b) => {
      b.onclick = () => {
        if (warmPick !== null) return;
        warmPick = Number(b.dataset.warm);
        render();
      };
    });
    container.querySelectorAll('[data-toggle-pat]').forEach((h) => {
      h.onclick = () => {
        const id = h.dataset.togglePat;
        if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
        render();
      };
    });
    container.querySelectorAll('[data-reveal]').forEach((el) => {
      el.onclick = () => el.classList.toggle('is-hidden');
    });
    container.querySelectorAll('[data-say]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); speakJP(b.dataset.say); };
    });
    container.querySelectorAll('[data-jump]').forEach((b) => {
      b.onclick = () => document.getElementById(b.dataset.jump)?.scrollIntoView({ behavior: 'smooth' });
    });

    const baseBox = container.querySelector('#gr-base-box');
    bindExerciseEvents(baseBox, baseList, baseStates, () => {
      if (baseStates.every((s) => s.done)) {
        const right = baseStates.filter((s) => s.correct).length;
        recordTest(level, 'grammar', meta.id, Math.round((right / baseList.length) * 100));
      }
      render();
    });

    const moreBtn = container.querySelector('#gr-more-btn');
    if (moreBtn) moreBtn.onclick = () => { showExtra = true; render(); };
    if (showExtra) {
      const extraBox = container.querySelector('#gr-extra-box');
      bindExerciseEvents(extraBox, extraList, extraStates, () => render());
    }
  }

  render();
}