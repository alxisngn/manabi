import { escapeHtml } from '../../../core/util.js';
import { parseRuby } from '../../../core/ruby.js';
import { speakJP } from '../../../core/tts.js';
import { addWeak, removeWeak, isSameWord } from '../../../core/weak.js';
import { buildQuestions } from './build.js';
import { buildGateQuestions, evaluateGate } from './gate.js';
import { renderMcq, renderTf, bindChoice } from './choice.js';
import { renderPairs, bindPairs } from './pairs.js';
import { renderTyping, bindTyping, handleTypingKeyDown } from './typing.js';
import { renderResult } from './result.js';

export function mountQuiz(container, allWords = [], onBack, opts = {}) {
  if (!allWords.length) return onBack && onBack();

  const gate = opts.gate || null;
  const isWeakReview = Boolean(opts.weakReview);
  const distractorPool = opts.poolWords?.length ? [...allWords, ...opts.poolWords] : allWords;

  let step = gate || isWeakReview ? 'play' : 'setup';
  let inputMode = isWeakReview ? 'type' : 'mcq';
  let maxQ = allWords.length, numQ = maxQ, soundOn = true;
  let questions = gate
    ? buildGateQuestions(gate.words, gate.poolWords)
    : isWeakReview
      ? buildQuestions(allWords, distractorPool, maxQ, true)
      : [];
  let qIdx = 0, score = 0, clearedCount = 0, wrongWords = [], gateResult = null;
  let feedbackAnim = '';

  const getTotalItems = () => questions.reduce((sum, item) => sum + (item.weight || 1), 0);
  const maybeSpeak = (w, q) => {
    if (!soundOn || !w) return;
    if (isWeakReview && inputMode === 'type') return;
    if (!q || q.dir !== 'vi-jp') speakJP(w.reading || w.jp);
  };

  const onKeyDown = (e) => {
    if (!document.body.contains(container)) return document.removeEventListener('keydown', onKeyDown);
    if (step !== 'play' || document.querySelector('dialog[open]')) return;
    const q = questions[qIdx];
    if (!q) return;
    if (!q.answered) {
      if (isWeakReview && inputMode === 'type') return handleTypingKeyDown(e, container);
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (q.type === 'mcq' && ['1', '2', '3', '4'].includes(e.key)) container.querySelector(`.qz-opt[data-i="${Number(e.key) - 1}"]`)?.click();
      else if (q.type === 'tf' && (e.key === '1' || e.key === '2')) container.querySelector(`.qz-tf[data-v="${e.key === '1' ? 'true' : 'false'}"]`)?.click();
    } else if (e.key === 'Enter' || (!(isWeakReview && inputMode === 'type') && e.key === ' ')) {
      e.preventDefault();
      container.querySelector('#qz-next')?.click();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const exitQuiz = () => { document.removeEventListener('keydown', onKeyDown); if (onBack) onBack(); };

  function startQuiz(pool, count) {
    questions = gate
      ? buildGateQuestions(gate.words, gate.poolWords, wrongWords)
      : buildQuestions(pool, distractorPool, count, isWeakReview);
    qIdx = 0; score = 0; clearedCount = 0; wrongWords = []; gateResult = null; feedbackAnim = ''; step = 'play';
    render(); maybeSpeak(questions[0]?.word, questions[0]);
  }

  function handleCorrect(q) {
    score++;
    feedbackAnim = 'anim-pop';
    if (!gate && removeWeak(q.word)) { q.clearedWeak = true; clearedCount++; }
    if (soundOn && isWeakReview && inputMode === 'type') speakJP(q.word.reading || q.word.jp);
  }

  function recordWrong(w) {
    feedbackAnim = 'anim-shake';
    addWeak(w);
    if (!wrongWords.some((x) => isSameWord(x, w))) wrongWords.push(w);
    if (soundOn && isWeakReview && inputMode === 'type') speakJP(w.reading || w.jp);
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

    const isTyping = isWeakReview && inputMode === 'type';
    const explainHtml = renderExplanation(q, currentAnim);
    const mainHtml = isTyping
      ? renderTyping(q, currentAnim, explainHtml)
      : q.type === 'mcq'
        ? renderMcq(q, currentAnim, explainHtml)
        : q.type === 'tf'
          ? renderTf(q, currentAnim, explainHtml)
          : renderPairs(q, explainHtml);

    const titleText = gate ? `QUA BÀI: ${escapeHtml(gate.lessonName)}` : isWeakReview ? 'ÔN TẬP TỪ SAI' : 'KIỂM TRA';
    const weakModeSwitchHtml = isWeakReview ? `
      <button type="button" class="btn qz-mode-sw ${inputMode === 'type' ? 'btn-teal' : ''}" data-m="type" style="min-height:40px;padding:4px 12px;font-size:0.85rem;">⌨️ Tự gõ</button>
      <button type="button" class="btn qz-mode-sw ${inputMode === 'mcq' ? 'btn-teal' : ''}" data-m="mcq" style="min-height:40px;padding:4px 12px;font-size:0.85rem;">🔘 Trắc nghiệm</button>
    ` : '';

    container.innerHTML = `
      <style>.qz-grid{display:grid;grid-template-columns:1fr;gap:10px;}@media(min-width:420px){.qz-grid{grid-template-columns:1fr 1fr;}.qz-tf-wrap{grid-template-columns:1fr auto 1fr;}}</style>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="font-size:1.12rem;font-weight:800;letter-spacing:0.3px;">${titleText}</span>
            <span id="qz-step-badge" style="padding:2px 10px;border-radius:999px;background:#CBECEB;color:#101320;font-weight:800;font-size:0.82rem;">Câu ${currentStep}/${total}</span>
          </div>
          <div style="width:100%;height:10px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:999px;overflow:hidden;"><div id="qz-progress-bar" style="width:${pct}%;height:100%;background:#187E78;border-radius:999px;transition:width 0.25s ease;"></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          ${weakModeSwitchHtml}
          <button type="button" id="qz-mute" class="btn btn-icon btn-yellow" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
          <button type="button" id="qz-quit" class="btn btn-icon" style="background:var(--red);color:#fff;border-color:#101320;" title="Thoát">⏻</button>
        </div>
      </div>
      ${mainHtml}`;

    container.querySelector('#qz-mute').onclick = () => { soundOn = !soundOn; renderPlay(); };
    container.querySelector('#qz-quit').onclick = exitQuiz;
    container.querySelectorAll('.qz-mode-sw').forEach((b) => {
      b.onclick = () => {
        if (inputMode !== b.dataset.m) {
          inputMode = b.dataset.m;
          renderPlay();
          if (inputMode === 'mcq' && !q.answered) maybeSpeak(q.word, q);
        }
      };
    });

    container.querySelector('#qz-speak')?.addEventListener('click', () => speakJP(q.word.reading || q.word.jp));
    container.querySelector('#qz-next')?.addEventListener('click', () => {
      if (qIdx < questions.length - 1) { qIdx++; renderPlay(); maybeSpeak(questions[qIdx]?.word, questions[qIdx]); }
      else {
        if (gate) gateResult = evaluateGate(gate, score, total);
        step = 'result'; render();
      }
    });

    if (isTyping) return bindTyping(container, q, { onCorrect: handleCorrect, recordWrong, renderPlay });
    if (q.type === 'match') {
      return bindPairs(container, q, {
        doneBefore,
        total,
        maybeSpeak,
        recordWrong,
        onPairMatch: (lw) => { score++; if (!gate && removeWeak(lw)) clearedCount++; },
        onAllMatched: (isPerfect) => { if (isPerfect) feedbackAnim = 'anim-pop'; renderPlay(); }
      });
    }
    bindChoice(container, q, { onCorrect: handleCorrect, recordWrong, renderPlay });
  }

  function render() {
    if (step === 'setup') return renderSetup();
    if (step === 'play') return renderPlay();
    renderResult(container, { gate, isWeakReview, score, total: getTotalItems(), clearedCount, wrongWords, gateResult }, {
      onRetryGate: () => startQuiz(gate.words, gate.words.length),
      onNextGate: () => { document.removeEventListener('keydown', onKeyDown); gate.onNextLesson(); },
      onRetryWrong: () => startQuiz([...wrongWords], wrongWords.length),
      onRetryAll: () => { step = 'setup'; render(); },
      onExit: exitQuiz
    });
  }

  render();
  if (gate || isWeakReview) maybeSpeak(questions[0]?.word, questions[0]);
}