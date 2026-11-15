import { updateStore } from '../../core/store.js';
import { PASS_RATE, recordTest } from '../../core/progress.js';
import { shuffle, pickN, escapeHtml } from '../../core/util.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';

const STORE_KEY = 'vocab';
const BADGE_COLORS = ['#18B899', '#F5C84F', '#F08F7A', '#8AE1DF', '#A78BFA', '#F472B6'];
const sameWord = (a, b) => a && b && a.jp === b.jp && a.vi === b.vi;

function saveWrongWord(word) {
  if (!word?.jp) return;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? [...cur.weakWords] : [];
    if (!list.some((w) => sameWord(w, word))) list.push(word);
    return { ...cur, weakWords: list };
  }, { weakWords: [] });
}

function removeWeakWord(word) {
  if (!word?.jp) return false;
  let removed = false;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? cur.weakWords : [];
    const next = list.filter((w) => !sameWord(w, word));
    if (next.length < list.length) removed = true;
    return { ...cur, weakWords: next };
  }, { weakWords: [] });
  return removed;
}

function buildQuestions(pool, allWords, count) {
  const targets = shuffle(pool).slice(0, count);
  const src = allWords.length >= 4 ? allWords : pool;
  const qs = [];
  let i = 0;

  while (i < targets.length) {
    const rem = targets.length - i;
    const canMatch = src.length >= 6 && rem >= 6;
    const types = canMatch ? ['mcq', 'tf', 'match'] : ['mcq', 'tf'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'match') {
      const pairs = targets.slice(i, i + 6);
      qs.push({
        type: 'match',
        word: pairs[0],
        weight: pairs.length,
        left: shuffle(pairs),
        right: shuffle(pairs),
        matchedIds: [],
        mistakeIds: [],
        wrongLeftIdx: -1,
        wrongRightIdx: -1,
        selLeft: -1,
        selRight: -1,
        answered: false,
        correct: false
      });
      i += pairs.length;
    } else {
      const word = targets[i++];
      if (type === 'mcq') {
        const dist = pickN(src, 3, word, (w) => `${w.jp}|${w.vi}`);
        qs.push({ type: 'mcq', dir: 'jp-vi', word, weight: 1, options: shuffle([word, ...dist]), answered: false, correct: false, clearedWeak: false, chosenIdx: -1 });
      } else {
        const isTrue = Math.random() < 0.5 || src.length < 2;
        const other = isTrue ? word : (pickN(src, 1, word, (w) => w.vi)[0] || word);
        qs.push({ type: 'tf', word, weight: 1, shownVi: other.vi, isMatch: other.vi === word.vi, answered: false, correct: false, clearedWeak: false, chosenVal: null });
      }
    }
  }
  return qs;
}

function buildGateQuestions(lessonWords, poolWords, priorityWrong = []) {
  const wrongSet = new Set(priorityWrong.map((w) => `${w.jp}|${w.vi}`));
  const head = shuffle(lessonWords.filter((w) => wrongSet.has(`${w.jp}|${w.vi}`)));
  const tail = shuffle(lessonWords.filter((w) => !wrongSet.has(`${w.jp}|${w.vi}`)));
  const ordered = [...head, ...tail];
  const half = Math.ceil(ordered.length / 2);
  const dirs = shuffle(ordered.map((_, i) => (i < half ? 'jp-vi' : 'vi-jp')));

  return ordered.map((word, idx) => {
    const dir = dirs[idx];
    const normVi = (v) => String(v || '').trim().toLowerCase();
    const isValidDist = (cand) => !sameWord(cand, word) && normVi(cand.vi) !== normVi(word.vi) && (dir === 'jp-vi' || cand.jp !== word.jp);
    const sameLessonValid = lessonWords.filter(isValidDist);
    let dist = pickN(sameLessonValid, 3, word, (w) => (dir === 'jp-vi' ? normVi(w.vi) : w.jp));
    if (dist.length < 3 && poolWords?.length) {
      const usedKeys = new Set(dist.map((w) => (dir === 'jp-vi' ? normVi(w.vi) : w.jp)));
      const extraValid = poolWords.filter((w) => isValidDist(w) && !usedKeys.has(dir === 'jp-vi' ? normVi(w.vi) : w.jp));
      dist = [...dist, ...pickN(extraValid, 3 - dist.length, word, (w) => (dir === 'jp-vi' ? normVi(w.vi) : w.jp))];
    }
    return { type: 'mcq', dir, word, weight: 1, options: shuffle([word, ...dist]), answered: false, correct: false, clearedWeak: false, chosenIdx: -1 };
  });
}

export function mountQuiz(container, allWords = [], onBack, opts = {}) {
  if (!allWords.length) return onBack && onBack();

  const gate = opts.gate || null;
  const isWeakReview = Boolean(opts.weakReview);
  let step = gate || isWeakReview ? 'play' : 'setup';
  let maxQ = allWords.length, numQ = maxQ, soundOn = true;
  let questions = gate ? buildGateQuestions(gate.words, gate.poolWords) : isWeakReview ? buildQuestions(allWords, allWords, maxQ) : [];
  let qIdx = 0, score = 0, clearedCount = 0, wrongWords = [], gateResult = null;
  let feedbackAnim = '';

  const getTotalItems = () => questions.reduce((sum, item) => sum + (item.weight || 1), 0);
  const maybeSpeak = (w, q) => { if (soundOn && w && (!q || q.dir !== 'vi-jp')) speakJP(w.reading || w.jp); };

  const onKeyDown = (e) => {
    if (!document.body.contains(container)) return document.removeEventListener('keydown', onKeyDown);
    if (step !== 'play' || document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
    const q = questions[qIdx];
    if (!q) return;
    if (!q.answered) {
      if (q.type === 'mcq' && ['1', '2', '3', '4'].includes(e.key)) container.querySelector(`.qz-opt[data-i="${Number(e.key) - 1}"]`)?.click();
      else if (q.type === 'tf' && (e.key === '1' || e.key === '2')) container.querySelector(`.qz-tf[data-v="${e.key === '1' ? 'true' : 'false'}"]`)?.click();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); container.querySelector('#qz-next')?.click(); }
  };
  document.addEventListener('keydown', onKeyDown);

  const exitQuiz = () => { document.removeEventListener('keydown', onKeyDown); if (onBack) onBack(); };

  function startQuiz(pool, count) {
    questions = gate ? buildGateQuestions(gate.words, gate.poolWords, wrongWords) : buildQuestions(pool, allWords, count);
    qIdx = 0; score = 0; clearedCount = 0; wrongWords = []; gateResult = null; feedbackAnim = ''; step = 'play';
    render(); maybeSpeak(questions[0]?.word, questions[0]);
  }

  function handleCorrect(q) {
    score++;
    feedbackAnim = 'anim-pop';
    if (!gate && removeWeakWord(q.word)) { q.clearedWeak = true; clearedCount++; }
  }

  function recordWrong(w) {
    feedbackAnim = 'anim-shake';
    saveWrongWord(w);
    if (!wrongWords.some((x) => sameWord(x, w))) wrongWords.push(w);
  }

  function renderSetup() {
    const presets = [...new Set([Math.min(10, maxQ), Math.min(20, maxQ), Math.min(30, maxQ), maxQ])];
    container.innerHTML = `
      <div style="max-width:560px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <button type="button" id="qz-back" class="btn">← Chế độ học</button>
          <span class="badge badge-ready">Tổng ${maxQ} từ</span>
        </div>
        <div class="card" style="display:flex;flex-direction:column;gap:14px;">
          <div class="module-title">Thiết lập bài Kiểm tra</div>
          <p class="module-sub">Mỗi từ tương ứng 1 câu hỏi (trộn Trắc nghiệm 1–4, Đúng / Sai và Nối cặp 2 chiều). Từ làm sai tự động lưu vào Từ cần ôn lại.</p>
          <label style="font-weight:700;font-size:0.95rem;">Số câu hỏi / số từ (1 – ${maxQ}):</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${presets.map((n) => `<button type="button" class="btn qz-preset ${n === numQ ? 'btn-teal' : ''}" data-n="${n}" style="flex:1;">${n === maxQ ? `Tất cả (${n})` : `${n} câu`}</button>`).join('')}</div>
          <input type="number" id="qz-num" min="1" max="${maxQ}" value="${numQ}" style="width:100%;min-height:44px;padding:8px 12px;border-radius:12px;border:2px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:1.05rem;font-weight:700;">
          <button type="button" id="qz-go" class="btn btn-yellow" style="width:100%;font-size:1.1rem;">🚀 Bắt đầu kiểm tra</button>
        </div>
      </div>`;
    container.querySelector('#qz-back').onclick = exitQuiz;
    container.querySelectorAll('.qz-preset').forEach((b) => { b.onclick = () => { numQ = Number(b.dataset.n); renderSetup(); }; });
    container.querySelector('#qz-num').onchange = (e) => { numQ = Math.max(1, Math.min(maxQ, Number(e.target.value) || 1)); };
    container.querySelector('#qz-go').onclick = () => { numQ = Math.max(1, Math.min(maxQ, Number(container.querySelector('#qz-num').value) || maxQ)); startQuiz(allWords, numQ); };
  }

  function renderExplanation(q, animCls) {
    if (!q.answered) return '';
    const nextLabel = qIdx < questions.length - 1 ? 'Câu tiếp theo →' : 'Xem kết quả 🏁';
    if (q.type === 'match') return `<button type="button" id="qz-next" class="btn btn-yellow ${animCls}" style="width:100%;margin-top:14px;">${nextLabel} <span class="kbd-hint">Enter ↵</span></button>`;
    const w = q.word;
    const statusText = q.correct ? (q.clearedWeak ? '✓ Đúng rồi! Đã xóa khỏi Từ cần ôn lại' : '✓ Chính xác!') : '✕ Chưa đúng (đã lưu vào Từ cần ôn lại)';
    return `
      <div class="card ${animCls}" style="margin-top:14px;border-color:${q.correct ? 'var(--green)' : 'var(--red)'};display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-weight:800;color:${q.correct ? 'var(--green)' : 'var(--red)'};font-size:1.02rem;">${statusText}</span>
          <button type="button" id="qz-speak" class="btn" style="padding:4px 12px;font-size:0.9rem;">🔊 Nghe</button>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
          <span class="jp" style="font-size:1.45rem;font-weight:700;">${escapeHtml(w.jp)}</span>
          ${w.reading ? `<span class="jp" style="color:var(--teal);font-weight:600;">【${escapeHtml(w.reading)}】</span>` : ''}
          <span style="color:var(--yellow);font-weight:800;font-size:1.15rem;">— ${escapeHtml(w.vi)}</span>
        </div>
        ${w.ex ? `<div style="padding-top:8px;border-top:1.5px dashed var(--border);"><div class="jp" style="font-size:0.98rem;line-height:1.7;">${parseRuby(w.ex)}</div>${w.exVi ? `<div style="font-size:0.88rem;color:var(--text-muted);">${escapeHtml(w.exVi)}</div>` : ''}</div>` : ''}
        <button type="button" id="qz-next" class="btn btn-yellow" style="width:100%;margin-top:4px;">${nextLabel} <span class="kbd-hint">Enter ↵</span></button>
      </div>`;
  }

  function renderPlay() {
    const q = questions[qIdx];
    const total = getTotalItems();
    const doneBefore = questions.slice(0, qIdx).reduce((sum, item) => sum + (item.weight || 1), 0);
    const currentStep = q.type === 'match'
      ? Math.min(doneBefore + q.matchedIds.length + 1, doneBefore + q.weight)
      : doneBefore + 1;
    const pct = Math.max(3, Math.round((currentStep / total) * 100));
    const currentAnim = feedbackAnim;
    feedbackAnim = '';

    let mainHtml = '';
    if (q.type === 'mcq') {
      const isViJp = q.dir === 'vi-jp';
      const optsHtml = q.options.map((opt, i) => {
        const isAns = sameWord(opt, q.word);
        let bd = 'var(--border)', bg = 'var(--bg-card)', animCls = '';
        if (q.answered) {
          if (isAns) { bd = 'var(--green)'; bg = 'rgba(76,175,106,0.2)'; if (i === q.chosenIdx) animCls = currentAnim; }
          else if (i === q.chosenIdx) { bd = 'var(--red)'; bg = 'rgba(217,72,59,0.22)'; animCls = currentAnim; }
        }
        return `
          <button type="button" class="card qz-opt ${animCls}" data-i="${i}" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;border-color:${bd};background:${bg};text-align:left;min-height:58px;">
            <span style="width:32px;height:32px;border-radius:10px;background:${BADGE_COLORS[i]};color:#101320;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
            <span class="${isViJp ? 'jp' : ''}" style="flex:1;font-weight:700;font-size:${isViJp ? '1.18rem' : '1.02rem'};color:var(--text);text-align:center;padding-right:16px;">${escapeHtml(isViJp ? opt.jp : opt.vi)}</span>
          </button>`;
      }).join('');

      mainHtml = `
        <div class="study-split">
          <div class="study-left">
            <div class="card" style="padding:16px;margin-bottom:14px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--teal);color:var(--teal);background:rgba(91,192,190,0.12);">${isViJp ? 'Việt → Nhật' : 'Nhật → Việt'}</span>
                <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${isViJp ? 'Chọn từ tiếng Nhật tương ứng' : 'Hãy chọn nghĩa đúng'}</span>
              </div>
              <div class="${isViJp ? '' : 'jp'}" style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:16px;padding:34px 14px;text-align:center;font-size:${isViJp ? 'clamp(1.35rem,4vw,1.9rem)' : 'clamp(1.85rem,5vw,2.6rem)'};font-weight:700;">${escapeHtml(isViJp ? q.word.vi : q.word.jp)}</div>
            </div>
          </div>
          <div class="study-right">
            <div class="qz-grid">${optsHtml}</div>
            ${renderExplanation(q, currentAnim)}
          </div>
        </div>`;
    } else if (q.type === 'tf') {
      const btnStyle = (val) => {
        let bd = 'var(--border)', bg = 'var(--bg-card)';
        if (q.answered) { if (val === q.isMatch) { bd = 'var(--green)'; bg = 'rgba(76,175,106,0.2)'; } else if (val === q.chosenVal) { bd = 'var(--red)'; bg = 'rgba(217,72,59,0.22)'; } }
        return `border-color:${bd};background:${bg};`;
      };
      mainHtml = `
        <div class="study-split">
          <div class="study-left">
            <div class="card" style="padding:16px;margin-bottom:14px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;"><span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--yellow);color:var(--yellow);background:rgba(245,200,79,0.12);">Đúng / Sai</span><span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">Thuật ngữ và nghĩa dưới đây có khớp nhau không?</span></div>
              <div class="qz-tf-wrap" style="display:grid;gap:10px;">
                <div class="jp" style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:14px;padding:24px 12px;text-align:center;font-size:1.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${escapeHtml(q.word.jp)}</div>
                <div style="width:36px;height:36px;border-radius:50%;background:var(--yellow);color:#101320;font-weight:800;display:flex;align-items:center;justify-content:center;margin:auto;border:2px solid #101320;">=</div>
                <div style="background:#2A261B;border:1.5px solid #574F35;border-radius:14px;padding:24px 12px;text-align:center;font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;">${escapeHtml(q.shownVi)}</div>
              </div>
            </div>
          </div>
          <div class="study-right">
            <div class="qz-grid">
              <button type="button" class="card qz-tf ${q.answered && q.chosenVal === true ? currentAnim : ''}" data-v="true" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;cursor:pointer;${btnStyle(true)}"><span style="width:30px;height:30px;border-radius:50%;background:var(--green);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;">✓</span><span style="font-size:1.1rem;font-weight:800;color:var(--text);">Đúng <span class="kbd-hint">1</span></span></button>
              <button type="button" class="card qz-tf ${q.answered && q.chosenVal === false ? currentAnim : ''}" data-v="false" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;cursor:pointer;${btnStyle(false)}"><span style="width:30px;height:30px;border-radius:50%;background:var(--red);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;">✕</span><span style="font-size:1.1rem;font-weight:800;color:var(--text);">Sai <span class="kbd-hint">2</span></span></button>
            </div>
            ${renderExplanation(q, currentAnim)}
          </div>
        </div>`;
    } else {
      const rowsHtml = q.left.map((lw, i) => {
        const rw = q.right[i], lM = q.matchedIds.includes(lw.jp), rM = q.matchedIds.includes(rw.jp), lS = q.selLeft === i, rS = q.selRight === i, lW = q.wrongLeftIdx === i, rW = q.wrongRightIdx === i;
        return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><button type="button" class="qz-m-left ${lW ? 'anim-shake' : ''}" data-i="${i}" ${lM || q.answered ? 'disabled' : ''} style="min-height:48px;padding:8px;border-radius:12px;border:2px solid ${lW ? 'var(--red)' : lM ? 'var(--green)' : lS ? 'var(--teal)' : 'var(--border)'};background:${lW ? 'rgba(217,72,59,0.25)' : lM ? 'rgba(76,175,106,0.22)' : lS ? 'rgba(91,192,190,0.2)' : 'var(--bg-elevated)'};color:var(--text);font-family:var(--font-jp);font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span>${escapeHtml(lw.jp)}</span></button><button type="button" class="qz-m-right ${rW ? 'anim-shake' : ''}" data-i="${i}" ${rM || q.answered ? 'disabled' : ''} style="min-height:48px;padding:8px;border-radius:12px;border:2px solid ${rW ? 'var(--red)' : rM ? 'var(--green)' : rS ? 'var(--teal)' : '#574F35'};background:${rW ? 'rgba(217,72,59,0.25)' : rM ? 'rgba(76,175,106,0.22)' : rS ? 'rgba(91,192,190,0.2)' : '#2A261B'};color:var(--text);font-family:var(--font-ui);font-size:0.92rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span>${escapeHtml(rw.vi)}</span></button></div>`;
      }).join('');
      mainHtml = `
        <div class="card" style="padding:14px;max-width:680px;margin:0 auto;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;"><div style="display:flex;align-items:center;gap:8px;"><span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--border);color:var(--text);background:var(--bg-elevated);">Nối cặp</span><span style="font-size:0.86rem;color:var(--text-muted);font-weight:600;">Chọn bên nào trước cũng được</span></div><span id="qz-m-count" style="font-weight:800;font-size:0.88rem;">${q.matchedIds.length} / ${q.weight} cặp</span></div>
          <div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div>
          ${renderExplanation(q, currentAnim)}
        </div>`;
    }

    const titleText = gate ? `QUA BÀI: ${escapeHtml(gate.lessonName)}` : isWeakReview ? 'ÔN TẬP TỪ SAI' : 'KIỂM TRA';
    container.innerHTML = `
      <style>.qz-grid{display:grid;grid-template-columns:1fr;gap:10px;}@media(min-width:420px){.qz-grid{grid-template-columns:1fr 1fr;}.qz-tf-wrap{grid-template-columns:1fr auto 1fr;}}</style>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="font-size:1.12rem;font-weight:800;letter-spacing:0.3px;">${titleText}</span>
            <span id="qz-step-badge" style="padding:2px 10px;border-radius:999px;background:#CBECEB;color:#101320;font-weight:800;font-size:0.82rem;">Câu ${currentStep}/${total}</span>
          </div>
          <div style="width:100%;height:10px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:999px;overflow:hidden;"><div id="qz-progress-bar" style="width:${pct}%;height:100%;background:#187E78;border-radius:999px;transition:width 0.25s ease;"></div></div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button type="button" id="qz-mute" class="btn btn-icon btn-yellow" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
          <button type="button" id="qz-quit" class="btn btn-icon" style="background:var(--red);color:#fff;border-color:#101320;" title="Thoát">⏻</button>
        </div>
      </div>
      ${mainHtml}`;

    container.querySelector('#qz-mute').onclick = () => { soundOn = !soundOn; renderPlay(); };
    container.querySelector('#qz-quit').onclick = exitQuiz;
    container.querySelector('#qz-speak')?.addEventListener('click', () => speakJP(q.word.reading || q.word.jp));
    container.querySelector('#qz-next')?.addEventListener('click', () => {
      if (qIdx < questions.length - 1) { qIdx++; renderPlay(); maybeSpeak(questions[qIdx]?.word, questions[qIdx]); }
      else {
        if (gate) {
          const rawPct = (score / total) * 100;
          gateResult = { pct: Math.round(rawPct), passed: rawPct >= PASS_RATE * 100 };
          recordTest(gate.level, 'vocab', gate.lessonId, gateResult.pct);
        }
        step = 'result'; render();
      }
    });
    container.querySelectorAll('.qz-opt').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.i);
        q.chosenIdx = idx; q.answered = true; q.correct = sameWord(q.options[idx], q.word);
        if (q.correct) handleCorrect(q); else recordWrong(q.word);
        renderPlay();
      };
    });
    container.querySelectorAll('.qz-tf').forEach((btn) => {
      btn.onclick = () => {
        const val = btn.dataset.v === 'true';
        q.chosenVal = val; q.answered = true; q.correct = val === q.isMatch;
        if (q.correct) handleCorrect(q); else recordWrong(q.word);
        renderPlay();
      };
    });

    const syncMatchUI = () => {
      const lBtns = container.querySelectorAll('.qz-m-left');
      const rBtns = container.querySelectorAll('.qz-m-right');
      lBtns.forEach((b, i) => {
        const lw = q.left[i], m = q.matchedIds.includes(lw.jp), s = q.selLeft === i, w = q.wrongLeftIdx === i;
        b.disabled = m || q.answered;
        b.classList.toggle('anim-shake', w);
        b.style.borderColor = w ? 'var(--red)' : m ? 'var(--green)' : s ? 'var(--teal)' : 'var(--border)';
        b.style.background = w ? 'rgba(217,72,59,0.25)' : m ? 'rgba(76,175,106,0.22)' : s ? 'rgba(91,192,190,0.2)' : 'var(--bg-elevated)';
      });
      rBtns.forEach((b, i) => {
        const rw = q.right[i], m = q.matchedIds.includes(rw.jp), s = q.selRight === i, w = q.wrongRightIdx === i;
        b.disabled = m || q.answered;
        b.classList.toggle('anim-shake', w);
        b.style.borderColor = w ? 'var(--red)' : m ? 'var(--green)' : s ? 'var(--teal)' : '#574F35';
        b.style.background = w ? 'rgba(217,72,59,0.25)' : m ? 'rgba(76,175,106,0.22)' : s ? 'rgba(91,192,190,0.2)' : '#2A261B';
      });
      const cntEl = container.querySelector('#qz-m-count');
      if (cntEl) cntEl.textContent = `${q.matchedIds.length} / ${q.weight} cặp`;

      const stepNow = Math.min(doneBefore + q.matchedIds.length + 1, doneBefore + q.weight);
      const badgeEl = container.querySelector('#qz-step-badge');
      const barEl = container.querySelector('#qz-progress-bar');
      if (badgeEl) badgeEl.textContent = `Câu ${stepNow}/${total}`;
      if (barEl) barEl.style.width = `${Math.max(3, Math.round((stepNow / total) * 100))}%`;
    };

    const checkMatchPair = (lIdx, rIdx) => {
      const lw = q.left[lIdx], rw = q.right[rIdx];
      if (sameWord(lw, rw)) {
        q.matchedIds.push(lw.jp);
        q.selLeft = -1;
        q.selRight = -1;
        if (!q.mistakeIds.includes(lw.jp)) {
          score++;
          if (!gate && removeWeakWord(lw)) clearedCount++;
        }
        if (q.matchedIds.length === q.left.length) {
          q.answered = true;
          q.correct = q.mistakeIds.length === 0;
          if (q.correct) feedbackAnim = 'anim-pop';
          renderPlay();
        } else {
          syncMatchUI();
        }
      } else {
        if (!q.mistakeIds.includes(lw.jp)) q.mistakeIds.push(lw.jp);
        q.wrongLeftIdx = lIdx;
        q.wrongRightIdx = rIdx;
        recordWrong(lw);
        syncMatchUI();
        setTimeout(() => {
          q.wrongLeftIdx = -1;
          q.wrongRightIdx = -1;
          q.selLeft = -1;
          q.selRight = -1;
          syncMatchUI();
        }, 450);
      }
    };

    container.querySelectorAll('.qz-m-left').forEach((btn) => {
      btn.onclick = () => {
        const lIdx = Number(btn.dataset.i);
        q.wrongLeftIdx = -1;
        q.wrongRightIdx = -1;
        maybeSpeak(q.left[lIdx]);
        if (q.selRight >= 0) return checkMatchPair(lIdx, q.selRight);
        q.selLeft = q.selLeft === lIdx ? -1 : lIdx;
        syncMatchUI();
      };
    });

    container.querySelectorAll('.qz-m-right').forEach((btn) => {
      btn.onclick = () => {
        const rIdx = Number(btn.dataset.i);
        q.wrongLeftIdx = -1;
        q.wrongRightIdx = -1;
        if (q.selLeft >= 0) return checkMatchPair(q.selLeft, rIdx);
        q.selRight = q.selRight === rIdx ? -1 : rIdx;
        syncMatchUI();
      };
    });
  }

  function renderResult() {
    const total = getTotalItems();
    if (gate) {
      const { passed } = gateResult || { passed: false };
      const reqPct = Math.round(PASS_RATE * 100);
      const wrongListHtml = wrongWords.map((w) => `
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:var(--bg-elevated);border:1.5px solid var(--border);text-align:left;flex-wrap:wrap;">
          <div><span class="jp" style="font-weight:700;font-size:1.05rem;">${escapeHtml(w.jp)}</span>${w.reading ? ` <span class="jp" style="color:var(--teal);font-size:0.88rem;">(${escapeHtml(w.reading)})</span>` : ''}</div>
          <span style="color:var(--yellow);font-weight:700;font-size:0.92rem;">${escapeHtml(w.vi)}</span>
        </div>`).join('');

      container.innerHTML = `
        <div class="card ${passed ? 'anim-pop' : 'anim-shake'}" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:28px 20px;max-width:540px;margin:0 auto;">
          <div class="module-title" style="font-size:1.45rem;color:${passed ? 'var(--green)' : 'var(--coral)'};">
            ${passed ? `Hoàn thành ${escapeHtml(gate.lessonName)} 🎉` : `Đúng ${score}/${total} — cần ${reqPct}%`}
          </div>
          <p class="module-sub">${passed ? 'Bạn đã vượt qua bài kiểm tra!' : 'Các từ trả lời sai đã được lưu vào Từ cần ôn lại.'}</p>
          ${!passed && wrongWords.length ? `<div style="display:flex;flex-direction:column;gap:6px;">${wrongListHtml}</div>` : ''}
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
            ${passed && gate.onNextLesson ? `<button type="button" id="gt-next-lesson" class="btn btn-teal">Bài tiếp theo (${escapeHtml(gate.nextLesson.name)}) →</button>` : ''}
            ${!passed ? `<button type="button" id="gt-retry" class="btn btn-yellow">↻ Làm lại</button>` : ''}
            <button type="button" id="qz-done" class="btn">← Về danh sách</button>
          </div>
        </div>`;
      container.querySelector('#gt-next-lesson')?.addEventListener('click', () => { document.removeEventListener('keydown', onKeyDown); gate.onNextLesson(); });
      container.querySelector('#gt-retry')?.addEventListener('click', () => startQuiz(gate.words, gate.words.length));
      container.querySelector('#qz-done').onclick = exitQuiz;
      return;
    }

    const pct = Math.round((score / total) * 100);
    const summaryMsg = [clearedCount ? `Đã xóa ${clearedCount} từ thuộc khỏi Từ cần ôn lại.` : '', wrongWords.length ? `Còn ${wrongWords.length} từ sai cần ôn tiếp.` : 'Không còn từ sai nào!'].filter(Boolean).join(' ');
    container.innerHTML = `
      <div class="card anim-pop" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:28px 20px;max-width:540px;margin:0 auto;">
        <div class="module-title" style="font-size:1.5rem;">${isWeakReview ? 'Hoàn thành Ôn tập!' : 'Hoàn thành Kiểm tra!'}</div>
        <div style="font-size:2.5rem;font-weight:800;color:var(--teal);">${score} / ${total} <span style="font-size:1.2rem;color:var(--yellow);">(${pct}%)</span></div>
        <p class="module-sub">${summaryMsg}</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
          ${wrongWords.length ? `<button type="button" id="qz-retry-wrong" class="btn btn-coral">🔥 Ôn tiếp ${wrongWords.length} từ sai</button>` : ''}
          ${!isWeakReview ? `<button type="button" id="qz-retry-all" class="btn btn-teal">↻ Làm đề mới</button>` : ''}
          <button type="button" id="qz-done" class="btn">← Quay lại</button>
        </div>
      </div>`;
    container.querySelector('#qz-retry-wrong')?.addEventListener('click', () => startQuiz([...wrongWords], wrongWords.length));
    container.querySelector('#qz-retry-all')?.addEventListener('click', () => { step = 'setup'; render(); });
    container.querySelector('#qz-done').onclick = exitQuiz;
  }

  function render() { if (step === 'setup') renderSetup(); else if (step === 'play') renderPlay(); else renderResult(); }
  render();
  if (gate || isWeakReview) maybeSpeak(questions[0]?.word, questions[0]);
}