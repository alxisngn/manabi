import { shuffle, pickN, escapeHtml } from '../../core/util.js';
import { speakJP } from '../../core/tts.js';
import { addWeak, isSameWord } from '../../core/weak.js';

const TIME_LIMIT = 5000;
const BADGE_COLORS = ['#18B899', '#F5C84F', '#F08F7A', '#8AE1DF'];

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
      <div class="card" style="padding:0;overflow:hidden;border-radius:22px;box-shadow:6px 7px 0 var(--shadow);">
        <div style="background:#362321;padding:18px;border-bottom:2px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:44px;height:44px;border-radius:14px;background:rgba(91,192,190,0.16);border:2px solid var(--teal);color:var(--teal);display:flex;align-items:center;justify-content:center;font-size:1.35rem;flex-shrink:0;">⚡</div>
            <div>
              <div style="font-size:1.35rem;font-weight:800;line-height:1.2;">Luyện phản xạ</div>
              <div style="font-size:0.88rem;color:var(--text-muted);margin-top:4px;">Luyện phản xạ nhanh qua Nghe hiểu hoặc Thử thách tốc độ 5 giây/câu.</div>
            </div>
          </div>
          <button type="button" id="rx-close" class="btn btn-icon" style="width:40px;height:40px;min-height:40px;border-radius:12px;" aria-label="Đóng">✕</button>
        </div>

        <div style="padding:18px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <div style="font-weight:800;font-size:0.95rem;margin-bottom:10px;">Chọn hình thức</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <button type="button" class="card rx-mode" data-m="listen" style="padding:16px 12px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;border-color:${mode === 'listen' ? 'var(--teal)' : 'var(--border)'};background:${mode === 'listen' ? 'rgba(91,192,190,0.12)' : 'var(--bg-elevated)'};">
                <span style="width:46px;height:46px;border-radius:14px;background:#173A3A;color:var(--teal);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🎧</span>
                <span style="font-weight:800;font-size:1.05rem;color:var(--text);">Nghe hiểu</span>
                <span style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Nghe phát âm, chọn nghĩa đúng</span>
              </button>
              <button type="button" class="card rx-mode" data-m="speed" style="padding:16px 12px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;border-color:${mode === 'speed' ? 'var(--yellow)' : 'var(--border)'};background:${mode === 'speed' ? 'rgba(245,200,79,0.12)' : 'var(--bg-elevated)'};">
                <span style="width:46px;height:46px;border-radius:14px;background:#3D2522;color:var(--coral);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">⏱️</span>
                <span style="font-weight:800;font-size:1.05rem;color:var(--text);">Thử thách tốc độ</span>
                <span style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">5 giây/câu, tính điểm & combo</span>
              </button>
            </div>
          </div>

          <div>
            <div style="font-weight:800;font-size:0.95rem;margin-bottom:8px;">Chọn số từ cần kiểm tra <span style="color:var(--red);">*</span></div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div style="display:inline-flex;align-items:center;background:var(--bg);border:2px solid var(--border);border-radius:14px;padding:4px;">
                <button type="button" id="rx-dec" class="btn btn-icon" style="width:42px;height:42px;min-height:42px;border-radius:10px;box-shadow:none;">−</button>
                <input type="number" id="rx-count" min="1" max="${maxW}" value="${count}" style="width:74px;text-align:center;background:transparent;border:none;color:var(--text);font-family:var(--font-ui);font-size:1.05rem;font-weight:800;">
                <button type="button" id="rx-inc" class="btn btn-icon" style="width:42px;height:42px;min-height:42px;border-radius:10px;box-shadow:none;">+</button>
              </div>
              <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">từ · tối đa ${maxW}</span>
            </div>
          </div>

          <button type="button" id="rx-start" class="btn btn-yellow" style="width:100%;font-size:1.1rem;min-height:50px;">Bắt đầu làm bài →</button>
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
    const cardBorder = q.status === 'correct' ? 'var(--green)' : q.status === 'wrong' ? 'var(--red)' : 'var(--border)';

    const optsHtml = q.options.map((opt, i) => {
      const isAns = isSameWord(opt, q.word);
      let bd = 'var(--border)', bg = 'var(--bg-card)';
      if (answered) {
        if (isAns) { bd = 'var(--green)'; bg = 'rgba(76,175,106,0.28)'; }
        else if (i === q.chosenIdx) { bd = 'var(--red)'; bg = 'rgba(217,72,59,0.28)'; }
      }
      return `
        <button type="button" class="card rx-opt" data-i="${i}" ${answered ? 'disabled' : ''} style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;border-color:${bd};background:${bg};min-height:60px;text-align:left;transition:background 0.12s,border-color 0.12s;">
          <span style="width:30px;height:30px;border-radius:9px;background:${BADGE_COLORS[i]};color:#101320;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
          <span style="flex:1;font-weight:700;font-size:1rem;color:var(--text);text-align:center;padding-right:18px;">${escapeHtml(opt.vi)}</span>
        </button>`;
    }).join('');

    const promptHtml = mode === 'listen'
      ? `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px 10px;">
          <button type="button" id="rx-replay" class="btn btn-teal" style="width:76px;height:76px;border-radius:50%;font-size:2rem;box-shadow:0 0 0 8px rgba(91,192,190,0.16), 3px 4px 0 var(--shadow);" aria-label="Nghe lại">🔊</button>
          <div class="jp" style="font-size:${answered ? '1.6rem' : '0.95rem'};font-weight:700;color:${answered ? 'var(--yellow)' : 'var(--text-muted)'};min-height:32px;">
            ${answered ? `${escapeHtml(q.word.jp)} ${q.word.reading ? `(${escapeHtml(q.word.reading)})` : ''}` : 'Bấm loa để nghe lại'}
          </div>
        </div>`
      : `
        <div style="padding:26px 10px;text-align:center;">
          <div class="jp" style="font-size:clamp(1.9rem,6.5vw,2.6rem);font-weight:700;">${escapeHtml(q.word.jp)}</div>
        </div>`;

    container.innerHTML = `
      <style>
        .rx-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 420px) { .rx-grid { grid-template-columns: 1fr 1fr; } }
      </style>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
        <button type="button" id="rx-quit" class="btn btn-icon" style="width:44px;height:44px;" aria-label="Thoát">✕</button>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <span class="badge">Câu ${idx + 1}/${questions.length}</span>
          ${mode === 'speed' ? `<span class="badge" style="color:var(--coral);border-color:var(--coral);">🔥 ${combo}x</span>` : ''}
          <span class="badge badge-ready">${score} điểm</span>
        </div>
      </div>

      ${mode === 'speed' ? `
        <div style="width:100%;height:12px;background:var(--bg-card);border:2px solid var(--border);border-radius:999px;overflow:hidden;margin-bottom:12px;">
          <div id="rx-bar" style="width:100%;height:100%;background:var(--teal);transition:width 0.05s linear,background-color 0.2s;"></div>
        </div>` : ''}

      <div class="card" style="margin-bottom:14px;border-color:${cardBorder};background:${q.status === 'correct' ? 'rgba(76,175,106,0.12)' : q.status === 'wrong' ? 'rgba(217,72,59,0.12)' : 'var(--bg-card)'};transition:border-color 0.12s,background 0.12s;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="padding:2px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;border:1.5px solid var(--teal);color:var(--teal);">
            ${mode === 'listen' ? '🎧 Nghe hiểu' : '⏱️ Phản xạ 5s'}
          </span>
          <span id="rx-sec" style="font-size:0.88rem;font-weight:800;color:var(--yellow);">${mode === 'speed' ? '5.0s' : ''}</span>
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
            bar.style.width = `${pct}%`;
            bar.style.background = left < 1300 ? 'var(--red)' : left < 2600 ? 'var(--yellow)' : 'var(--teal)';
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
      <div class="card" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:24px 18px;">
        <div class="module-title" style="font-size:1.5rem;">Hoàn thành Luyện phản xạ!</div>
        <div style="font-size:2.6rem;font-weight:800;color:var(--yellow);">${score} điểm</div>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
          <span class="badge badge-ready">Đúng ${correctCount}/${questions.length} (${acc}%)</span>
          ${mode === 'speed' ? `<span class="badge" style="color:var(--coral);border-color:var(--coral);">🔥 Max Combo: ${maxCombo}x</span>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
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