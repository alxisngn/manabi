import { parseRuby } from '../../core/ruby.js';
import { escapeHtml } from '../../core/util.js';

export function renderExerciseCard(ex, idx, state, opts = {}) {
  const num = idx + 1;
  const tag = opts.tag || (ex.type === 'star' ? 'Sắp xếp ★' : 'Trắc nghiệm');
  const answered = state.done;

  if (ex.type === 'star') {
    const slots = state.slots || [null, null, null, null];
    const slotsHtml = slots.map((choiceIdx, sIdx) => {
      const filled = choiceIdx !== null;
      const text = filled ? parseRuby(ex.choices[choiceIdx]) : `${sIdx + 1}`;
      return `<div class="gr-slot ${sIdx === ex.starIndex ? 'is-star' : ''} ${filled ? 'is-filled' : ''}" data-slot="${sIdx}">${text}</div>`;
    }).join('');

    const poolHtml = ex.choices.map((c, cIdx) => {
      const used = slots.includes(cIdx);
      let cls = '';
      if (answered) {
        if (cIdx === ex.answer) cls = 'is-right';
        else if (slots[ex.starIndex] === cIdx) cls = 'is-wrong';
      }
      return `<button type="button" class="btn gr-opt gr-chip ${used ? 'is-used' : ''} ${cls}" data-star-pick="${cIdx}" ${answered ? 'disabled' : ''}>${cIdx + 1}. ${parseRuby(c)}</button>`;
    }).join('');

    const fb = answered
      ? `<div class="gr-exp ${state.correct ? '' : 'is-err'}">${state.correct ? '✅ Chính xác!' : '❌ Chưa đúng.'} ${escapeHtml(ex.explain || '')}</div>`
      : '';

    return `<div class="card gr-q-card" data-qbox="${idx}">
      <div class="gr-q-meta"><span>Câu ${num} • ${tag}</span>${!answered && slots.some((x) => x !== null) ? '<button type="button" class="btn gr-pill" data-star-clear="1">Xóa xếp</button>' : ''}</div>
      <div class="gr-q-text jp">${parseRuby(ex.prefix)} [ ___ ___ ★ ___ ] ${parseRuby(ex.suffix)}</div>
      <div class="gr-star-slots">${slotsHtml}</div>
      <div class="gr-star-pool">${poolHtml}</div>
      ${fb}
    </div>`;
  }

  const optsHtml = ex.choices.map((c, cIdx) => {
    let cls = '';
    if (opts.examMode && !answered) {
      if (state.picked === cIdx) cls = 'is-picked';
    } else if (answered) {
      if (cIdx === ex.answer) cls = 'is-right';
      else if (state.picked === cIdx) cls = 'is-wrong';
    }
    return `<button type="button" class="btn gr-opt ${cls}" data-choice="${cIdx}" ${answered && !opts.examMode ? 'disabled' : ''}>${cIdx + 1}. ${parseRuby(c)}</button>`;
  }).join('');

  const fb = answered && ex.explain
    ? `<div class="gr-exp ${state.correct ? '' : 'is-err'}">${state.correct ? '✅ Chính xác!' : '❌ Chưa đúng.'} ${escapeHtml(ex.explain)}</div>`
    : '';

  return `<div class="card gr-q-card" data-qbox="${idx}">
    <div class="gr-q-meta"><span>Câu ${num} • ${tag}</span></div>
    <div class="gr-q-text jp">${parseRuby(ex.q)}</div>
    <div class="gr-opts">${optsHtml}</div>
    ${fb}
  </div>`;
}

export function bindExerciseEvents(root, list, states, onUpdate, opts = {}) {
  root.querySelectorAll('[data-qbox]').forEach((box) => {
    const idx = Number(box.dataset.qbox);
    const ex = list[idx];
    const st = states[idx];

    box.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.onclick = () => {
        const picked = Number(btn.dataset.choice);
        st.picked = picked;
        if (!opts.examMode) {
          st.done = true;
          st.correct = picked === ex.answer;
        }
        onUpdate(idx);
      };
    });

    box.querySelectorAll('[data-star-pick]').forEach((btn) => {
      btn.onclick = () => {
        if (st.done && !opts.examMode) return;
        const cIdx = Number(btn.dataset.starPick);
        if (!st.slots) st.slots = [null, null, null, null];
        const exist = st.slots.indexOf(cIdx);
        if (exist >= 0) {
          st.slots[exist] = null;
        } else {
          const empty = st.slots.indexOf(null);
          if (empty >= 0) st.slots[empty] = cIdx;
        }
        if (st.slots.every((x) => x !== null)) {
          st.picked = st.slots[ex.starIndex];
          if (!opts.examMode) {
            st.done = true;
            st.correct = st.picked === ex.answer;
          }
        }
        onUpdate(idx);
      };
    });

    box.querySelectorAll('[data-slot]').forEach((el) => {
      el.onclick = () => {
        if (st.done && !opts.examMode) return;
        const sIdx = Number(el.dataset.slot);
        if (st.slots) st.slots[sIdx] = null;
        onUpdate(idx);
      };
    });

    const clr = box.querySelector('[data-star-clear]');
    if (clr) {
      clr.onclick = () => {
        st.slots = [null, null, null, null];
        st.picked = null;
        onUpdate(idx);
      };
    }
  });
}