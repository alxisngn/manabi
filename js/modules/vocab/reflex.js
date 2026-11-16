import { shuffle, pickN, escapeHtml } from '../../core/util.js';
import { speakJP } from '../../core/tts.js';
import { addWeak, isSameWord } from '../../core/weak.js';

const TIME_LIMIT = 5000;

function buildRounds(pool, allWords, count) {
  const targets = shuffle(pool).slice(0, count);
  const src = allWords.length >= 4 ? allWords : pool;
  return targets.map((word) => {
    const distractors = pickN(src, 3, word, (w) => `${w.jp}|${w.vi}`);
    return { word, options: shuffle([word, ...distractors]), chosenIdx: -1, status: 'pending' };
  });
}

export function mountReflex(container, allWords = [], onBack) {
  if (!allWords.length) return onBack && onBack();

  let step = 'setup', mode = 'listen', maxW = allWords.length, count = maxW;
  let questions = [], idx = 0, score = 0, combo = 0, maxCombo = 0, correctCount = 0;
  let wrongWords = [], timerId = null, nextTimer = null;

  const clearTimers = () => {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  };

  const exit = () => { clearTimers(); if (onBack) onBack(); };

  function startSession(pool, n) {
    clearTimers();
    questions = buildRounds(pool, allWords, n);
    idx = 0; score = 0; combo = 0; maxCombo = 0; correctCount = 0; wrongWords = [];
    step = 'play';
    renderPlay();
  }

  function recordWrong(w) {
    addWeak(w);
    if (!wrongWords.some((x) => isSameWord(x, w))) wrongWords.push(w);
  }

  function handleAnswer(chosenIdx) {
    const q = questions[idx];
    if (!q || q.status !== 'pending') return;
    clearTimers();
    q.chosenIdx = chosenIdx;
    const picked = chosenIdx >= 0 ? q.options[chosenIdx] : null;
    const isRight = isSameWord(picked, q.word);

    if (isRight) {
      q.status = 'correct';
      correctCount++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      score += mode === 'speed' ? 100 + Math.min(combo, 10) * 20 : 100;
    } else {
      q.status = 'wrong';
      combo = 0;
      recordWrong(q.word);
    }

    renderPlay(false);
    nextTimer = setTimeout(() => {
      if (idx < questions.length - 1) {
        idx++;
        renderPlay(true);
      } else {
        step = 'result';
        renderResult();
      }
    }, 520);
  }

  function renderSetup() {
    clearTimers();
    container.innerHTML = `
      <div class="card rx-setup-card">
        <div class="rx-setup-head">
          <div class="rx-setup-intro">
            <div class="rx-hero-ico">⚡</div>
            <div>
              <div class="rx-hero-title">Luyện phản xạ</div>
              <div class="rx-hero-sub">Luyện phản xạ nhanh qua Nghe hiểu hoặc Thử thách tốc độ 5 giây/câu.</div>
            </div>
          </div>
          <button type="button" id="rx-close" class="btn btn-icon rx-close-btn" aria-label="Đóng">✕</button>
        </div>

        <div class="rx-setup-body">
          <div>
            <div class="rx-sec-lbl rx-sec-lbl-lg">Chọn hình thức</div>
            <div class="rx-mode-grid">
              <button type="button" class="card rx-mode ${mode === 'listen' ? 'is-listen' : ''}" data-m="listen">
                <span class="rx-mode-ico is-listen">🎧</span>
                <span class="rx-mode-name">Nghe hiểu</span>
                <span class="rx-mode-desc">Nghe phát âm, chọn nghĩa đúng</span>
              </button>
              <button type="button" class="card rx-mode ${mode === 'speed' ? 'is-speed' : ''}" data-m="speed">
                <span class="rx-mode-ico is-speed">⏱️</span>
                <span class="rx-mode-name">Thử thách tốc độ</span>
                <span class="rx-mode-desc">5 giây/câu, tính điểm & combo</span>
              </button>
            </div>
          </div>

          <div>
            <div class="rx-sec-lbl">Chọn số từ cần kiểm tra <span class="rx-req">*</span></div>
            <div class="row gap-12 rx-wrap">
              <div class="rx-stepper">
                <button type="button" id="rx-dec" class="btn btn-icon rx-step-btn">−</button>
                <input type="number" id="rx-count" class="rx-count-inp" min="1" max="${maxW}" value="${count}">
                <button type="button" id="rx-inc" class="btn btn-icon rx-step-btn">+</button>
              </div>
              <span class="text-base text-muted">từ · tối đa ${maxW}</span>
            </div>
          </div>

          <button type="button" id="rx-start" class="btn btn-yellow w-full rx-start-btn">Bắt đầu làm bài →</button>
        </div>
      </div>
    `;

    container.querySelector('#rx-close').onclick = exit;
    container.querySelectorAll('.rx-mode').forEach((b) => {
      b.onclick = () => { mode = b.dataset.m; renderSetup(); };
    });
    const inp = container.querySelector('#rx-count');
    const syncCount = (val) => { count = Math.max(1, Math.min(maxW, Number(val) || 1)); inp.value = count; };
    container.querySelector('#rx-dec').onclick = () => syncCount(count - 5 >= 1 ? count - 5 : 1);
    container.querySelector('#rx-inc').onclick = () => syncCount(count + 5 <= maxW ? count + 5 : maxW);
    inp.onchange = (e) => syncCount(e.target.value);
    container.querySelector('#rx-start').onclick = () => { syncCount(inp.value); startSession(allWords, count); };
  }

  function renderPlay(isFresh = true) {
    const q = questions[idx];
    const answered = q.status !== 'pending';
    const cardState = q.status === 'correct' ? 'is-correct' : q.status === 'wrong' ? 'is-wrong' : '';

    const optsHtml = q.options.map((opt, i) => {
      const isAns = isSameWord(opt, q.word);
      let optState = '';
      if (answered) {
        if (isAns) optState = 'is-correct';
        else if (i === q.chosenIdx) optState = 'is-wrong';
      }
      return `
        <button type="button" class="card rx-opt ${optState}" data-i="${i}" ${answered ? 'disabled' : ''}>
          <span class="rx-opt-num">${i + 1}</span>
          <span class="grow center rx-opt-txt">${escapeHtml(opt.vi)}</span>
        </button>`;
    }).join('');

    const promptHtml = mode === 'listen'
      ? `
        <div class="rx-listen-box">
          <button type="button" id="rx-replay" class="btn btn-teal rx-replay-btn" aria-label="Nghe lại">🔊</button>
          <div class="jp rx-listen-word ${answered ? 'is-revealed' : ''}">
            ${answered ? `${escapeHtml(q.word.jp)} ${q.word.reading ? `(${escapeHtml(q.word.reading)})` : ''}` : 'Bấm loa để nghe lại'}
          </div>
        </div>`
      : `
        <div class="rx-speed-box">
          <div class="jp rx-speed-word">${escapeHtml(q.word.jp)}</div>
        </div>`;

    container.innerHTML = `
      <div class="row-between rx-topbar">
        <button type="button" id="rx-quit" class="btn btn-icon" aria-label="Thoát">✕</button>
        <div class="row rx-stats">
          <span class="badge">Câu ${idx + 1}/${questions.length}</span>
          ${mode === 'speed' ? `<span class="badge rx-combo">🔥 ${combo}x</span>` : ''}
          <span class="badge badge-ready">${score} điểm</span>
        </div>
      </div>

      ${mode === 'speed' ? `
        <div class="rx-timer-track">
          <div id="rx-bar" class="rx-timer-fill" style="--p:100"></div>
        </div>` : ''}

      <div class="card rx-prompt-card ${cardState}">
        <div class="row-between rx-prompt-head">
          <span class="rx-mode-tag">
            ${mode === 'listen' ? '🎧 Nghe hiểu' : '⏱️ Phản xạ 5s'}
          </span>
          <span id="rx-sec" class="rx-sec">${mode === 'speed' ? '5.0s' : ''}</span>
        </div>
        ${promptHtml}
      </div>

      <div class="rx-grid">${optsHtml}</div>
    `;

    container.querySelector('#rx-quit').onclick = exit;
    container.querySelector('#rx-replay')?.addEventListener('click', () => speakJP(q.word.reading || q.word.jp));
    container.querySelectorAll('.rx-opt').forEach((b) => {
      b.onclick = () => handleAnswer(Number(b.dataset.i));
    });

    if (isFresh) {
      speakJP(q.word.reading || q.word.jp);
      if (mode === 'speed') {
        const startAt = performance.now();
        timerId = setInterval(() => {
          const left = Math.max(0, TIME_LIMIT - (performance.now() - startAt));
          const pct = (left / TIME_LIMIT) * 100;
          const bar = container.querySelector('#rx-bar');
          const secEl = container.querySelector('#rx-sec');
          if (bar) {
            bar.style.setProperty('--p', pct);
            bar.classList.toggle('is-danger', left < 1300);
            bar.classList.toggle('is-warn', left >= 1300 && left < 2600);
          }
          if (secEl) secEl.textContent = `${(left / 1000).toFixed(1)}s`;
          if (left <= 0) handleAnswer(-1);
        }, 50);
      }
    }
  }

  function renderResult() {
    clearTimers();
    const acc = Math.round((correctCount / questions.length) * 100);
    container.innerHTML = `
      <div class="card center col rx-result-card">
        <div class="module-title text-lg">Hoàn thành Luyện phản xạ!</div>
        <div class="rx-final-score">${score} điểm</div>
        <div class="rx-result-badges">
          <span class="badge badge-ready">Đúng ${correctCount}/${questions.length} (${acc}%)</span>
          ${mode === 'speed' ? `<span class="badge rx-combo">🔥 Max Combo: ${maxCombo}x</span>` : ''}
        </div>
        <div class="rx-result-actions">
          ${wrongWords.length ? `<button type="button" id="rx-retry-wrong" class="btn btn-coral">🔥 Ôn lại ${wrongWords.length} từ sai</button>` : ''}
          <button type="button" id="rx-again" class="btn btn-teal">↻ Chơi lại</button>
          <button type="button" id="rx-done" class="btn">← Về menu chế độ</button>
        </div>
      </div>
    `;
    container.querySelector('#rx-retry-wrong')?.addEventListener('click', () => startSession([...wrongWords], wrongWords.length));
    container.querySelector('#rx-again').onclick = () => { step = 'setup'; renderSetup(); };
    container.querySelector('#rx-done').onclick = exit;
  }

  renderSetup();
}