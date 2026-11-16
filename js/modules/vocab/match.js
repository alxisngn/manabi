import { shuffle, escapeHtml } from '../../core/util.js';
import { speakJP } from '../../core/tts.js';
import { addWeak, isSameWord } from '../../core/weak.js';

const ROUND_SIZE = 10;

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
      <button type="button" class="mt-card ${c.kind === 'jp' ? 'mt-jp' : 'mt-vi'}" data-uid="${c.uid}" style="--fs:${cardFontSize(c)}">
        <span>${escapeHtml(c.text)}</span>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="row-between mb-12">
        <button type="button" id="mt-back" class="btn">← Chế độ học</button>
        <div class="row">
          <span class="badge">Vòng ${roundIdx + 1}/${rounds.length}</span>
          <span id="mt-timer" class="badge badge-ready center mt-timer">${formatTime(elapsedMs)}</span>
          <button type="button" id="mt-mute" class="btn btn-icon btn-yellow" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div class="mt-board">
        <div class="row-between mb-12 mt-board-head">
          <div class="mt-board-title">Ghép thuật ngữ với nghĩa</div>
          <div class="row mt-legend">
            <span class="mt-legend-item"><i class="mt-dot is-jp"></i>Thuật ngữ</span>
            <span class="mt-legend-item"><i class="mt-dot is-vi"></i>Nghĩa</span>
          </div>
        </div>
        <div id="mt-grid" class="mt-grid">${cardsHtml}</div>
        <p class="center mt-12 mt-hint">
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
      const isMatch = first.pairId === card.pairId || isSameWord(first.word, card.word);

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
        addWeak(first.kind === 'jp' ? first.word : card.word);
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
      <div class="card center col mt-result-card">
        <div class="module-title text-lg">Hoàn thành Ghép thẻ!</div>
        <div class="mt-result-time">${formatTime(elapsedMs)}</div>
        <p class="module-sub">
          Đã ghép xong <strong>${allWords.length}</strong> cặp từ (${rounds.length} vòng)
          ${mistakes ? `• Ghép nhầm <strong>${mistakes}</strong> lần (đã lưu vào Từ cần ôn lại).` : '• Không sai lần nào!'}
        </p>
        <div class="mt-result-actions">
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