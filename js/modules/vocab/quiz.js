import { updateStore } from '../../core/store.js';
import { shuffle, pickN, escapeHtml } from '../../core/util.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';

const STORE_KEY = 'vocab';
const BADGE_COLORS = ['#18B899', '#F5C84F', '#F08F7A', '#8AE1DF', '#A78BFA', '#F472B6'];

function saveWrongWord(word) {
  if (!word?.jp) return;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? [...cur.weakWords] : [];
    if (!list.some((w) => w.jp === word.jp && w.vi === word.vi)) list.push(word);
    return { ...cur, weakWords: list };
  }, { weakWords: [] });
}

function buildQuestions(pool, allWords, count) {
  const targets = shuffle(pool).slice(0, count);
  const sourcePool = allWords.length >= 4 ? allWords : pool;

  return targets.map((word) => {
    const types = ['mcq', 'tf'];
    if (sourcePool.length >= 6) types.push('match');
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'mcq') {
      const distractors = pickN(sourcePool, 3, word, (w) => `${w.jp}|${w.vi}`);
      return { type, word, options: shuffle([word, ...distractors]), answered: false, correct: false, chosenIdx: -1 };
    }
    if (type === 'tf') {
      const isTrue = Math.random() < 0.5 || sourcePool.length < 2;
      const other = isTrue ? word : (pickN(sourcePool, 1, word, (w) => w.vi)[0] || word);
      return { type, word, shownVi: other.vi, isMatch: other.vi === word.vi, answered: false, correct: false, chosenVal: null };
    }
    const others = pickN(sourcePool, 5, word, (w) => `${w.jp}|${w.vi}`);
    const pairs = shuffle([word, ...others]);
    return {
      type: 'match',
      word,
      left: shuffle(pairs),
      right: shuffle(pairs),
      matchedIds: [],
      wrongLeftIdx: -1,
      wrongRightIdx: -1,
      selLeft: -1,
      hadMistake: false,
      answered: false,
      correct: false
    };
  });
}

export function mountQuiz(container, allWords = [], onBack) {
  if (!allWords.length) return onBack && onBack();

  let step = 'setup', maxQ = allWords.length, numQ = maxQ, soundOn = true;
  let questions = [], qIdx = 0, score = 0, wrongWords = [];

  const maybeSpeak = (w) => { if (soundOn && w) speakJP(w.reading || w.jp); };

  function startQuiz(pool, count) {
    questions = buildQuestions(pool, allWords, count);
    qIdx = 0; score = 0; wrongWords = []; step = 'play';
    render();
    maybeSpeak(questions[0]?.word);
  }

  function recordWrong(w) {
    saveWrongWord(w);
    if (!wrongWords.some((x) => x.jp === w.jp && x.vi === w.vi)) wrongWords.push(w);
  }

  function renderSetup() {
    const presets = [...new Set([Math.min(10, maxQ), Math.min(20, maxQ), Math.min(30, maxQ), maxQ])];
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <button type="button" id="qz-back" class="btn">← Chế độ học</button>
        <span class="badge badge-ready">Tổng ${maxQ} từ</span>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:14px;">
        <div class="module-title">Thiết lập bài Kiểm tra</div>
        <p class="module-sub">Trộn ngẫu nhiên: Trắc nghiệm 4 đáp án, Đúng / Sai và Nối 6 cặp. Câu trả lời sai tự động lưu vào Từ đã sai.</p>
        <label style="font-weight:700;font-size:0.95rem;">Số câu hỏi (1 – ${maxQ}):</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${presets.map((n) => `<button type="button" class="btn qz-preset ${n === numQ ? 'btn-teal' : ''}" data-n="${n}" style="flex:1;">${n === maxQ ? `Tất cả (${n})` : `${n} câu`}</button>`).join('')}
        </div>
        <input type="number" id="qz-num" min="1" max="${maxQ}" value="${numQ}" style="width:100%;min-height:44px;padding:8px 12px;border-radius:12px;border:2px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:1.05rem;font-weight:700;">
        <button type="button" id="qz-go" class="btn btn-yellow" style="width:100%;font-size:1.1rem;">🚀 Bắt đầu kiểm tra</button>
      </div>
    `;
    container.querySelector('#qz-back').onclick = () => onBack && onBack();
    container.querySelectorAll('.qz-preset').forEach((b) => { b.onclick = () => { numQ = Number(b.dataset.n); renderSetup(); }; });
    container.querySelector('#qz-num').onchange = (e) => { numQ = Math.max(1, Math.min(maxQ, Number(e.target.value) || 1)); };
    container.querySelector('#qz-go').onclick = () => {
      numQ = Math.max(1, Math.min(maxQ, Number(container.querySelector('#qz-num').value) || maxQ));
      startQuiz(allWords, numQ);
    };
  }

  function renderExplanation(q) {
    if (!q.answered) return '';
    const w = q.word;
    return `
      <div class="card" style="margin-top:14px;border-color:${q.correct ? 'var(--green)' : 'var(--red)'};display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-weight:800;color:${q.correct ? 'var(--green)' : 'var(--red)'};font-size:1.05rem;">
            ${q.correct ? '✓ Chính xác!' : '✕ Chưa đúng (đã lưu vào Từ đã sai)'}
          </span>
          <button type="button" id="qz-speak" class="btn" style="min-height:36px;padding:4px 12px;font-size:0.88rem;">🔊 Nghe</button>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
          <span class="jp" style="font-size:1.45rem;font-weight:700;">${escapeHtml(w.jp)}</span>
          ${w.reading ? `<span class="jp" style="color:var(--teal);font-weight:600;">【${escapeHtml(w.reading)}】</span>` : ''}
          <span style="color:var(--yellow);font-weight:800;font-size:1.15rem;">— ${escapeHtml(w.vi)}</span>
        </div>
        ${w.ex ? `
          <div style="padding-top:8px;border-top:1.5px dashed var(--border);">
            <div class="jp" style="font-size:0.98rem;line-height:1.7;">${parseRuby(w.ex)}</div>
            ${w.exVi ? `<div style="font-size:0.88rem;color:var(--text-muted);">${escapeHtml(w.exVi)}</div>` : ''}
          </div>
        ` : ''}
        <button type="button" id="qz-next" class="btn btn-yellow" style="width:100%;margin-top:4px;">
          ${qIdx < questions.length - 1 ? 'Câu tiếp theo →' : 'Xem kết quả 🏁'}
        </button>
      </div>
    `;
  }

  function renderPlay() {
    const q = questions[qIdx];
    const total = questions.length;
    const pct = Math.max(3, Math.round(((qIdx + 1) / total) * 100));

    let bodyHtml = '';
    if (q.type === 'mcq') {
      const optsHtml = q.options.map((opt, i) => {
        const isAns = opt.jp === q.word.jp && opt.vi === q.word.vi;
        let bd = 'var(--border)', bg = 'var(--bg-card)';
        if (q.answered) {
          if (isAns) { bd = 'var(--green)'; bg = 'rgba(76,175,106,0.2)'; }
          else if (i === q.chosenIdx) { bd = 'var(--red)'; bg = 'rgba(217,72,59,0.22)'; }
        }
        return `
          <button type="button" class="card qz-opt" data-i="${i}" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;border-color:${bd};background:${bg};text-align:left;min-height:58px;">
            <span style="width:32px;height:32px;border-radius:10px;background:${BADGE_COLORS[i]};color:#101320;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
            <span style="flex:1;font-weight:700;font-size:1.02rem;color:var(--text);text-align:center;padding-right:20px;">${escapeHtml(opt.vi)}</span>
          </button>`;
      }).join('');

      bodyHtml = `
        <div class="card" style="padding:16px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--teal);color:var(--teal);background:rgba(91,192,190,0.12);">Chọn đáp án</span>
            <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">Hãy chọn đáp án đúng</span>
          </div>
          <div class="jp" style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:16px;padding:34px 12px;text-align:center;font-size:clamp(1.85rem,6vw,2.6rem);font-weight:700;">
            ${escapeHtml(q.word.jp)}
          </div>
        </div>
        <div class="qz-grid">${optsHtml}</div>
      `;
    } else if (q.type === 'tf') {
      const btnStyle = (val) => {
        let bd = 'var(--border)', bg = 'var(--bg-card)';
        if (q.answered) {
          if (val === q.isMatch) { bd = 'var(--green)'; bg = 'rgba(76,175,106,0.2)'; }
          else if (val === q.chosenVal) { bd = 'var(--red)'; bg = 'rgba(217,72,59,0.22)'; }
        }
        return `border-color:${bd};background:${bg};`;
      };
      bodyHtml = `
        <div class="card" style="padding:16px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
            <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--yellow);color:var(--yellow);background:rgba(245,200,79,0.12);">Đúng / Sai</span>
            <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">Thuật ngữ và nghĩa dưới đây có khớp nhau không?</span>
          </div>
          <div class="qz-tf-Wrap" style="position:relative;display:grid;gap:10px;">
            <div class="jp" style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:14px;padding:28px 12px;text-align:center;font-size:1.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;">
              ${escapeHtml(q.word.jp)}
            </div>
            <div style="width:36px;height:36px;border-radius:50%;background:var(--yellow);color:#101320;font-weight:800;display:flex;align-items:center;justify-content:center;margin:auto;border:2px solid #101320;z-index:2;">=</div>
            <div style="background:#2A261B;border:1.5px solid #574F35;border-radius:14px;padding:28px 12px;text-align:center;font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;">
              ${escapeHtml(q.shownVi)}
            </div>
          </div>
        </div>
        <div class="qz-grid">
          <button type="button" class="card qz-tf" data-v="true" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;cursor:pointer;${btnStyle(true)}">
            <span style="width:30px;height:30px;border-radius:50%;background:var(--green);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;">✓</span>
            <span style="font-size:1.1rem;font-weight:800;color:var(--text);">Đúng</span>
          </button>
          <button type="button" class="card qz-tf" data-v="false" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;cursor:pointer;${btnStyle(false)}">
            <span style="width:30px;height:30px;border-radius:50%;background:var(--red);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;">✕</span>
            <span style="font-size:1.1rem;font-weight:800;color:var(--text);">Sai</span>
          </button>
        </div>
      `;
    } else {
      const rowsHtml = q.left.map((lw, i) => {
        const rw = q.right[i];
        const lMatched = q.matchedIds.includes(lw.jp);
        const rMatched = q.matchedIds.includes(rw.jp);
        const lSel = q.selLeft === i;
        const lWrong = q.wrongLeftIdx === i;
        const rWrong = q.wrongRightIdx === i;

        return `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" class="qz-m-left" data-i="${i}" ${lMatched || q.answered ? 'disabled' : ''} style="min-height:50px;padding:8px 10px;border-radius:12px;border:2px solid ${lWrong ? 'var(--red)' : lMatched ? 'var(--green)' : lSel ? 'var(--teal)' : 'var(--border)'};background:${lWrong ? 'rgba(217,72,59,0.25)' : lMatched ? 'rgba(76,175,106,0.22)' : lSel ? 'rgba(91,192,190,0.2)' : 'var(--bg-elevated)'};color:var(--text);font-family:var(--font-jp);font-size:1.05rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">
              <span>${escapeHtml(lw.jp)}</span>
            </button>
            <button type="button" class="qz-m-right" data-i="${i}" ${rMatched || q.answered ? 'disabled' : ''} style="min-height:50px;padding:8px 10px;border-radius:12px;border:2px solid ${rWrong ? 'var(--red)' : rMatched ? 'var(--green)' : '#574F35'};background:${rWrong ? 'rgba(217,72,59,0.25)' : rMatched ? 'rgba(76,175,106,0.22)' : '#2A261B'};color:var(--text);font-family:var(--font-ui);font-size:0.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">
              <span>${escapeHtml(rw.vi)}</span>
            </button>
          </div>`;
      }).join('');

      bodyHtml = `
        <div class="card" style="padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--border);color:var(--text);background:var(--bg-elevated);">Nối cặp</span>
              <span style="font-size:0.88rem;color:var(--text-muted);font-weight:600;">Nối mỗi thuật ngữ với nghĩa đúng</span>
            </div>
            <span style="font-weight:800;font-size:0.9rem;">${q.matchedIds.length} / 6 cặp</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div>
        </div>
        <p style="text-align:center;font-size:0.84rem;color:var(--text-muted);margin-top:8px;">Chọn một ô bên trái, rồi chọn ô tương ứng bên phải.</p>
      `;
    }

    container.innerHTML = `
      <style>
        .qz-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 420px) { .qz-grid { grid-template-columns: 1fr 1fr; } .qz-tf-Wrap { grid-template-columns: 1fr auto 1fr; } }
      </style>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span style="font-size:1.3rem;font-weight:800;letter-spacing:0.5px;">KIỂM TRA</span>
            <span style="padding:2px 12px;border-radius:999px;background:#CBECEB;color:#101320;font-weight:800;font-size:0.85rem;">Câu ${qIdx + 1}/${total}</span>
          </div>
          <div style="width:100%;height:10px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:999px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#187E78;border-radius:999px;transition:width 0.2s;"></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" id="qz-mute" class="btn btn-icon btn-yellow" style="width:44px;height:44px;border-radius:12px;" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
          <button type="button" id="qz-quit" class="btn btn-icon" style="width:44px;height:44px;border-radius:12px;background:var(--red);color:#fff;border-color:#101320;" title="Thoát">⏻</button>
        </div>
      </div>
      ${bodyHtml}
      ${renderExplanation(q)}
    `;

    container.querySelector('#qz-mute').onclick = () => { soundOn = !soundOn; renderPlay(); };
    container.querySelector('#qz-quit').onclick = () => onBack && onBack();
    container.querySelector('#qz-speak')?.addEventListener('click', () => speakJP(q.word.reading || q.word.jp));
    container.querySelector('#qz-next')?.addEventListener('click', () => {
      if (qIdx < questions.length - 1) { qIdx++; renderPlay(); maybeSpeak(questions[qIdx]?.word); }
      else { step = 'result'; render(); }
    });

    container.querySelectorAll('.qz-opt').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.i);
        const picked = q.options[idx];
        q.chosenIdx = idx; q.answered = true;
        q.correct = picked.jp === q.word.jp && picked.vi === q.word.vi;
        if (q.correct) score++; else recordWrong(q.word);
        renderPlay();
      };
    });

    container.querySelectorAll('.qz-tf').forEach((btn) => {
      btn.onclick = () => {
        const val = btn.dataset.v === 'true';
        q.chosenVal = val; q.answered = true; q.correct = val === q.isMatch;
        if (q.correct) score++; else recordWrong(q.word);
        renderPlay();
      };
    });

    container.querySelectorAll('.qz-m-left').forEach((btn) => {
      btn.onclick = () => {
        q.selLeft = Number(btn.dataset.i); q.wrongLeftIdx = -1; q.wrongRightIdx = -1;
        maybeSpeak(q.left[q.selLeft]); renderPlay();
      };
    });

    container.querySelectorAll('.qz-m-right').forEach((btn) => {
      btn.onclick = () => {
        if (q.selLeft < 0) return;
        const rIdx = Number(btn.dataset.i);
        const lw = q.left[q.selLeft], rw = q.right[rIdx];
        if (lw.jp === rw.jp && lw.vi === rw.vi) {
          q.matchedIds.push(lw.jp); q.selLeft = -1;
          if (q.matchedIds.length === q.left.length) {
            q.answered = true; q.correct = !q.hadMistake;
            if (q.correct) score++;
          }
          renderPlay();
        } else {
          q.hadMistake = true; q.wrongLeftIdx = q.selLeft; q.wrongRightIdx = rIdx;
          recordWrong(lw); renderPlay();
          setTimeout(() => { q.wrongLeftIdx = -1; q.wrongRightIdx = -1; q.selLeft = -1; renderPlay(); }, 550);
        }
      };
    });
  }

  function renderResult() {
    const pct = Math.round((score / questions.length) * 100);
    container.innerHTML = `
      <div class="card" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:24px 18px;">
        <div class="module-title" style="font-size:1.5rem;">Hoàn thành Kiểm tra!</div>
        <div style="font-size:2.6rem;font-weight:800;color:var(--teal);">${score} / ${questions.length} <span style="font-size:1.2rem;color:var(--yellow);">(${pct}%)</span></div>
        <p class="module-sub">${wrongWords.length ? `Có ${wrongWords.length} từ trả lời sai đã được lưu vào danh sách Từ đã sai.` : 'Tuyệt vời! Bạn trả lời đúng toàn bộ câu hỏi.'}</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
          ${wrongWords.length ? `<button type="button" id="qz-retry-wrong" class="btn btn-coral">🔥 Ôn lại ${wrongWords.length} câu sai</button>` : ''}
          <button type="button" id="qz-retry-all" class="btn btn-teal">↻ Làm đề mới</button>
          <button type="button" id="qz-done" class="btn">← Về menu chế độ</button>
        </div>
      </div>
    `;
    container.querySelector('#qz-retry-wrong')?.addEventListener('click', () => startQuiz([...wrongWords], wrongWords.length));
    container.querySelector('#qz-retry-all').onclick = () => { step = 'setup'; render(); };
    container.querySelector('#qz-done').onclick = () => onBack && onBack();
  }

  function render() {
    if (step === 'setup') renderSetup();
    else if (step === 'play') renderPlay();
    else renderResult();
  }

  render();
}