import { updateStore } from '../../core/store.js';
import { shuffle, escapeHtml } from '../../core/util.js';
import { speakJP } from '../../core/tts.js';

const STORE_KEY = 'vocab';
const ROUND_SIZE = 10;

function saveWrongWord(word) {
  if (!word?.jp) return;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? [...cur.weakWords] : [];
    if (!list.some((w) => w.jp === word.jp && w.vi === word.vi)) list.push(word);
    return { ...cur, weakWords: list };
  }, { weakWords: [] });
}

function buildRounds(words) {
  const pool = shuffle(words);
  const rounds = [];
  for (let i = 0; i < pool.length; i += ROUND_SIZE) {
    rounds.push(pool.slice(i, i + ROUND_SIZE));
  }
  return rounds;
}

function formatTime(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export function mountMatch(container, allWords = [], onBack) {
  if (!Array.isArray(allWords) || allWords.length === 0) return onBack && onBack();

  let rounds = buildRounds(allWords);
  let roundIdx = 0, mistakes = 0, soundOn = true, elapsedMs = 0, lastTick = 0, timerId = null;

  const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
  const startTimer = () => {
    stopTimer();
    lastTick = performance.now();
    timerId = setInterval(() => {
      const now = performance.now();
      elapsedMs += now - lastTick;
      lastTick = now;
      const el = container.querySelector('#mt-timer');
      if (el) el.textContent = formatTime(elapsedMs);
    }, 100);
  };
  const exit = () => { stopTimer(); if (onBack) onBack(); };

  function renderRound() {
    const roundWords = rounds[roundIdx];
    const cards = shuffle(
      roundWords.flatMap((w, idx) => [
        { uid: `jp_${idx}`, pairId: idx, kind: 'jp', text: w.jp, word: w, state: 'idle' },
        { uid: `vi_${idx}`, pairId: idx, kind: 'vi', text: w.vi, word: w, state: 'idle' }
      ])
    );

    let selected = null, locked = false, matchedCount = 0;

    const cardFontSize = (c) => {
      const len = c.text.length;
      if (c.kind === 'jp') return len <= 3 ? '1.35rem' : len <= 6 ? '1.1rem' : '0.92rem';
      return len <= 8 ? '1.05rem' : len <= 16 ? '0.9rem' : '0.8rem';
    };

    const cardsHtml = cards.map((c) => `
      <button type="button" class="mt-card ${c.kind === 'jp' ? 'mt-jp' : 'mt-vi'}" data-uid="${c.uid}" style="font-size:${cardFontSize(c)};">
        <span>${escapeHtml(c.text)}</span>
      </button>
    `).join('');

    container.innerHTML = `
      <style>
        @keyframes mt-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
        .mt-board { background: #187971; border: 2.5px solid #0F101A; border-radius: 22px; padding: 14px; box-shadow: 5px 6px 0 #0F101A; }
        .mt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        @media (min-width: 430px) { .mt-grid { grid-template-columns: repeat(4, 1fr); gap: 10px; } }
        .mt-card {
          min-height: 76px; padding: 8px 6px; border-radius: 14px; border: 2.5px solid #121521;
          box-shadow: 3px 4px 0 #121521; display: flex; align-items: center; justify-content: center;
          text-align: center; font-weight: 700; color: #F4F5F8; cursor: pointer; line-height: 1.25;
          word-break: break-word; user-select: none;
          transition: transform 0.12s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.25s ease;
        }
        .mt-jp { background: #2C3147; font-family: var(--font-jp); }
        .mt-vi { background: #2C281B; font-family: var(--font-ui); }
        .mt-card.is-selected { border-color: #5BC0BE; box-shadow: 0 0 0 2px #5BC0BE, 3px 4px 0 #121521; transform: translateY(-2px); }
        .mt-card.is-matched { background: var(--green) !important; border-color: #1B5E2E !important; color: #fff !important; transform: scale(1.03); }
        .mt-card.is-gone { opacity: 0; transform: scale(0.84); pointer-events: none; visibility: hidden; transition: opacity 0.24s ease, transform 0.24s ease, visibility 0s linear 0.24s; }
        .mt-card.is-wrong { background: var(--red) !important; border-color: #7A1C14 !important; color: #fff !important; animation: mt-shake 0.35s ease; }
      </style>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <button type="button" id="mt-back" class="btn">← Chế độ học</button>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge">Vòng ${roundIdx + 1}/${rounds.length}</span>
          <span id="mt-timer" class="badge badge-ready" style="min-width:68px;text-align:center;">${formatTime(elapsedMs)}</span>
          <button type="button" id="mt-mute" class="btn btn-icon btn-yellow" style="width:44px;height:44px;" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div class="mt-board">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <div style="font-size:1.15rem;font-weight:800;color:#fff;">Ghép thuật ngữ với nghĩa</div>
          <div style="display:flex;align-items:center;gap:10px;font-size:0.78rem;font-weight:700;color:#E6F7F5;">
            <span style="display:inline-flex;align-items:center;gap:5px;"><i style="width:12px;height:12px;border-radius:4px;background:#2C3147;border:1.5px solid #121521;display:inline-block;"></i>Thuật ngữ</span>
            <span style="display:inline-flex;align-items:center;gap:5px;"><i style="width:12px;height:12px;border-radius:4px;background:#2C281B;border:1.5px solid #121521;display:inline-block;"></i>Nghĩa</span>
          </div>
        </div>
        <div id="mt-grid" class="mt-grid">${cardsHtml}</div>
        <p style="text-align:center;font-size:0.82rem;font-weight:700;color:#E6F7F5;margin-top:12px;">
          Chọn một thuật ngữ rồi chọn nghĩa tương ứng. Ghép đúng hết các cặp càng nhanh càng tốt!
        </p>
      </div>
    `;

    const syncCardDom = (card) => {
      const btn = container.querySelector(`[data-uid="${card.uid}"]`);
      if (!btn) return;
      btn.classList.remove('is-selected', 'is-matched', 'is-wrong', 'is-gone');
      if (card.state !== 'idle') btn.classList.add(`is-${card.state}`);
    };

    container.querySelector('#mt-back').onclick = exit;
    container.querySelector('#mt-mute').onclick = (e) => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? '🔊' : '🔇'; };

    container.querySelector('#mt-grid').onclick = (e) => {
      const btn = e.target.closest('.mt-card');
      if (!btn || locked) return;
      const card = cards.find((c) => c.uid === btn.dataset.uid);
      if (!card || card.state === 'matched' || card.state === 'gone') return;

      if (card.kind === 'jp' && soundOn) speakJP(card.word.reading || card.word.jp);

      if (!selected) { selected = card; card.state = 'selected'; syncCardDom(card); return; }
      if (selected.uid === card.uid) { selected.state = 'idle'; syncCardDom(selected); selected = null; return; }
      if (selected.kind === card.kind) {
        selected.state = 'idle'; syncCardDom(selected);
        card.state = 'selected'; syncCardDom(card);
        selected = card; return;
      }

      const first = selected;
      selected = null; locked = true;
      const isMatch = first.pairId === card.pairId || (first.word.jp === card.word.jp && first.word.vi === card.word.vi);

      if (isMatch) {
        first.state = 'matched'; card.state = 'matched';
        syncCardDom(first); syncCardDom(card);
        setTimeout(() => {
          first.state = 'gone'; card.state = 'gone';
          syncCardDom(first); syncCardDom(card);
          locked = false; matchedCount++;
          if (matchedCount === roundWords.length) {
            stopTimer();
            setTimeout(() => {
              if (roundIdx < rounds.length - 1) { roundIdx++; renderRound(); startTimer(); }
              else renderResult();
            }, 300);
          }
        }, 320);
      } else {
        mistakes++;
        saveWrongWord(first.kind === 'jp' ? first.word : card.word);
        first.state = 'wrong'; card.state = 'wrong';
        syncCardDom(first); syncCardDom(card);
        setTimeout(() => {
          first.state = 'idle'; card.state = 'idle';
          syncCardDom(first); syncCardDom(card);
          locked = false;
        }, 450);
      }
    };
  }

  function renderResult() {
    container.innerHTML = `
      <div class="card" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:24px 18px;">
        <div class="module-title" style="font-size:1.5rem;">Hoàn thành Ghép thẻ!</div>
        <div style="font-size:2.5rem;font-weight:800;color:var(--teal);">${formatTime(elapsedMs)}</div>
        <p class="module-sub">
          Đã ghép xong <strong>${allWords.length}</strong> cặp từ (${rounds.length} vòng)
          ${mistakes ? `• Ghép nhầm <strong>${mistakes}</strong> lần (đã lưu vào Từ cần ôn lại).` : '• Không sai lần nào!'}
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
          <button type="button" id="mt-replay" class="btn btn-teal">↻ Chơi lại (Trộn thẻ mới)</button>
          <button type="button" id="mt-done" class="btn">← Về menu chế độ</button>
        </div>
      </div>
    `;
    container.querySelector('#mt-replay').onclick = () => {
      rounds = buildRounds(allWords); roundIdx = 0; mistakes = 0; elapsedMs = 0;
      renderRound(); startTimer();
    };
    container.querySelector('#mt-done').onclick = exit;
  }

  renderRound();
  startTimer();
}