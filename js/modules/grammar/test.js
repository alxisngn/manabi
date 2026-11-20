import { setSession } from '../../core/nav.js';
import { recordTest } from '../../core/progress.js';
import { parseRuby } from '../../core/ruby.js';
import { escapeHtml } from '../../core/util.js';
import { renderExerciseCard, bindExerciseEvents } from './exercises.js';

export function mount(container, { level, meta, data, backHash }) {
  setSession(true);
  let showFuri = false;
  let submitted = false;
  let score = 0;
  let secLeft = data.timeLimitSec || 1200;

  const mainList = data.exercises || [];
  const mainStates = mainList.map(() => ({}));
  const cloze = data.clozePassage;
  const blanks = cloze?.blanks || [];
  const blankPicks = blanks.map(() => null);
  let activeBlank = 0;

  const timerId = window.setInterval(() => {
    if (submitted || !document.body.contains(container)) {
      window.clearInterval(timerId);
      return;
    }
    secLeft = Math.max(0, secLeft - 1);
    const el = container.querySelector('#gr-timer');
    if (el) el.textContent = formatTime(secLeft);
    if (secLeft === 0) gradeTest();
  }, 1000);

  function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function gradeTest() {
    if (submitted) return;
    submitted = true;
    window.clearInterval(timerId);
    let earned = 0;
    mainList.forEach((ex, i) => {
      const st = mainStates[i];
      st.done = true;
      st.correct = st.picked === ex.answer;
      if (st.correct) earned += ex.points || 5;
    });
    blanks.forEach((b, i) => {
      if (blankPicks[i] === b.answer) earned += b.points || 7;
    });
    score = Math.min(100, earned);
    recordTest(level, 'grammar', meta.id, score);
    render();
    container.scrollIntoView({ behavior: 'smooth' });
  }

  function renderPassage() {
    if (!cloze) return '';
    let idx = 0;
    const html = parseRuby(cloze.text).replace(/\{\{\d+\}\}/g, () => {
      const bIdx = idx++;
      const b = blanks[bIdx];
      const num = 14 + bIdx;
      const picked = blankPicks[bIdx];
      const label = picked !== null && b ? parseRuby(b.choices[picked]) : `[ ${num} ]`;
      let cls = bIdx === activeBlank && !submitted ? 'is-active' : '';
      if (submitted && b) cls += picked === b.answer ? ' is-right' : ' is-wrong';
      return `<button type="button" class="gr-blank ${cls}" data-blank="${bIdx}">${label}</button>`;
    });

    const curB = blanks[activeBlank];
    const curNum = 14 + activeBlank;
    const optsHtml = curB ? curB.choices.map((c, cIdx) => {
      let cls = '';
      if (!submitted && blankPicks[activeBlank] === cIdx) cls = 'is-picked';
      if (submitted) {
        if (cIdx === curB.answer) cls = 'is-right';
        else if (blankPicks[activeBlank] === cIdx) cls = 'is-wrong';
      }
      return `<button type="button" class="btn gr-opt ${cls}" data-bopt="${cIdx}" ${submitted ? 'disabled' : ''}>${cIdx + 1}. ${parseRuby(c)}</button>`;
    }).join('') : '';

    const fb = submitted && curB
      ? `<div class="gr-exp ${blankPicks[activeBlank] === curB.answer ? '' : 'is-err'}">Ô [${curNum}]: ${escapeHtml(curB.explain || '')}</div>`
      : '';

    return `
      <div class="gr-sec-head"><h2 class="gr-sec-title">Bài đọc điền từ (Câu 14–18)</h2></div>
      <div class="card gr-cloze-box jp">
        <div class="mb-8"><strong>${parseRuby(cloze.title || '')}</strong></div>
        <div>${html}</div>
      </div>
      <div class="card gr-q-card">
        <div class="gr-q-meta"><span>Đang chọn ô [${curNum}] (chạm số trên đoạn văn để đổi ô)</span></div>
        <div class="gr-opts">${optsHtml}</div>
        ${fb}
      </div>`;
  }

  function render() {
    const banner = submitted
      ? `<div class="card gr-score-banner">
          <div class="module-sub">Kết quả Kiểm tra Tuần</div>
          <div class="gr-score-big">${score} / 100 điểm</div>
        </div>`
      : '';

    const mainHtml = mainList.map((ex, i) => renderExerciseCard(ex, i, mainStates[i], { examMode: !submitted })).join('');

    container.innerHTML = `
      <div class="gr-wrap ${showFuri ? '' : 'hide-furigana'}">
        <div class="gr-top">
          <a href="${backHash}" class="btn gr-pill">← Thoát</a>
          <span id="gr-timer" class="gr-timer">⏱ ${formatTime(secLeft)}</span>
          <button type="button" id="gr-furi-btn" class="btn gr-pill ${showFuri ? 'is-on' : ''}">ふりがな</button>
        </div>

        ${banner}
        <div id="gr-test-main" class="gr-ex-list">${mainHtml}</div>
        ${renderPassage()}

        ${submitted
          ? `<a href="${backHash}" class="btn btn-teal">Hoàn tất & Quay lại Tuần</a>`
          : `<button type="button" id="gr-submit-btn" class="btn btn-yellow">Nộp bài & Chấm điểm</button>`}
      </div>
    `;

    container.querySelector('#gr-furi-btn').onclick = () => { showFuri = !showFuri; render(); };
    container.querySelectorAll('ruby').forEach((rb) => {
      if (rb.closest('button, a')) return;
      rb.onclick = (e) => { e.stopPropagation(); rb.classList.toggle('is-peek'); };
    });
    const mainBox = container.querySelector('#gr-test-main');
    bindExerciseEvents(mainBox, mainList, mainStates, () => render(), { examMode: !submitted });

    container.querySelectorAll('[data-blank]').forEach((b) => {
      b.onclick = () => { activeBlank = Number(b.dataset.blank); render(); };
    });
    container.querySelectorAll('[data-bopt]').forEach((b) => {
      b.onclick = () => {
        if (submitted) return;
        blankPicks[activeBlank] = Number(b.dataset.bopt);
        if (activeBlank < blanks.length - 1) activeBlank++;
        render();
      };
    });

    const subBtn = container.querySelector('#gr-submit-btn');
    if (subBtn) subBtn.onclick = gradeTest;
  }

  render();
}