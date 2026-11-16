import { escapeHtml } from '../../../core/util.js';
import { parseRuby } from '../../../core/ruby.js';

function formatPromptJP(jp) {
  const escaped = escapeHtml(jp);
  return escaped.replace(
    /^(「[^」]+」)\s*(.+)$/,
    '<span class="kr-prompt-prefix">$1</span> <span class="kr-prompt-word">$2</span>'
  );
}

export function renderEmpty(container, onBack) {
  container.innerHTML = `
    <div class="card center col kr-empty-card">
      <div class="module-title">Không có từ chứa Kanji</div>
      <p class="module-sub">Bài học này toàn bộ là từ Kana nên không cần luyện đọc Kanji.</p>
      <button type="button" id="kr-empty-back" class="btn btn-teal">← Quay lại</button>
    </div>`;
  container.querySelector('#kr-empty-back').onclick = () => onBack && onBack();
}

export function renderResult(container, { firstPassCorrect, totalUnique, wrongCount, onRetryWrong, onRetryAll, onExit }) {
  const pct = Math.min(100, Math.round((firstPassCorrect / totalUnique) * 100));
  container.innerHTML = `
    <div class="card anim-pop center col kr-done-card">
      <div class="module-title text-lg">Hoàn thành Đọc Kanji! 🎉</div>
      <div class="kr-done-score">${firstPassCorrect} / ${totalUnique} <span class="kr-done-pct">đúng ngay lần đầu (${pct}%)</span></div>
      <p class="module-sub">${wrongCount ? `Đã ôn lại trong phiên & lưu ${wrongCount} từ từng sai vào Từ cần ôn lại.` : 'Bạn đọc chuẩn ngay từ đầu tất cả chữ Hán!'}</p>
      <div class="kr-done-actions">
        ${wrongCount ? `<button type="button" id="kr-retry-wrong" class="btn btn-coral">🔥 Luyện lại ${wrongCount} từ từng sai</button>` : ''}
        <button type="button" id="kr-retry-all" class="btn btn-teal">↻ Luyện lại toàn bộ (${totalUnique} từ)</button>
        <button type="button" id="kr-done" class="btn">← Chế độ học</button>
      </div>
    </div>`;
  container.querySelector('#kr-retry-wrong')?.addEventListener('click', onRetryWrong);
  container.querySelector('#kr-retry-all').onclick = onRetryAll;
  container.querySelector('#kr-done').onclick = onExit;
}

function renderAnswerArea(q, inputMode, currentAnim) {
  if (inputMode === 'mcq') {
    const optsHtml = q.options.map((opt, i) => {
      const isAns = opt === q.correctReading;
      let stateCls = '', animCls = '';
      if (q.answered) {
        if (isAns) {
          stateCls = 'is-correct';
          if (i === q.chosenIdx) animCls = currentAnim;
        } else if (i === q.chosenIdx) {
          stateCls = 'is-wrong';
          animCls = currentAnim;
        }
      }
      return `
        <button type="button" class="card kr-opt ${stateCls} ${animCls}" data-i="${i}" ${q.answered ? 'disabled' : ''}>
          <span class="kr-opt-num">${i + 1}</span>
          <span class="jp grow center kr-opt-txt">${escapeHtml(opt)}</span>
        </button>`;
    }).join('');
    return `<div class="kr-grid">${optsHtml}</div>`;
  }

  const inpState = q.answered ? (q.correct ? 'is-correct' : 'is-wrong') : '';
  const inpAnim = q.answered ? currentAnim : '';
  return `
    <div class="card study-card-match kr-panel">
      <div class="kr-type-lbl">Nhập cách đọc (Romaji → Hiragana / Katakana)</div>
      <form id="kr-type-form" class="col">
        <input type="text" id="kr-type-inp" class="jp w-full center kr-inp ${inpState} ${inpAnim}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="Gõ romaji (vd: warimasu)..."
          value="${escapeHtml(q.typedVal)}" ${q.answered ? 'disabled' : ''}>
        ${!q.answered ? `
          <div class="kr-type-actions">
            <button type="submit" class="btn btn-teal kr-submit-btn">Kiểm tra <span class="kbd-hint">Enter ↵</span></button>
            <button type="button" id="kr-dont-know" class="btn kr-skip-btn">Không nhớ <span class="kbd-hint">Shift ↵</span></button>
          </div>` : ''}
      </form>
    </div>`;
}

function renderExplain(q, qIdx, totalQueue, currentAnim) {
  if (!q.answered) return '';
  const stateCls = q.correct ? 'is-correct' : 'is-wrong';
  return `
    <div class="card col gap-8 kr-explain ${stateCls} ${currentAnim}">
      <div class="row-between">
        <span class="kr-explain-status ${stateCls}">
          ${q.correct ? '✓ Đọc chính xác!' : '✕ Sai rồi — sẽ hỏi lại sau vài câu nữa'}
        </span>
        <button type="button" id="kr-speak" class="btn kr-speak-btn">🔊 Nghe</button>
      </div>
      <div class="kr-explain-word">
        <span class="jp kr-explain-jp">${escapeHtml(q.word.jp)}</span>
        <span class="jp kr-explain-reading">【${escapeHtml(q.correctReading)}】</span>
        <span class="kr-explain-vi">— ${escapeHtml(q.word.vi)}</span>
      </div>
      ${q.word.ex ? `<div class="kr-explain-ex"><div class="jp kr-explain-ex-jp">${parseRuby(q.word.ex)}</div>${q.word.exVi ? `<div class="kr-explain-ex-vi">${escapeHtml(q.word.exVi)}</div>` : ''}</div>` : ''}
      <button type="button" id="kr-next" class="btn btn-yellow w-full kr-next-btn">${qIdx < totalQueue - 1 ? 'Câu tiếp theo →' : 'Xem kết quả 🏁'} <span class="kbd-hint">Enter ↵</span></button>
    </div>`;
}

export function renderSession(container, props) {
  const { q, qIdx, totalQueue, inputMode, soundOn, currentAnim, onToggleSound, onExit, onSwitchMode, onSpeak, onNext, onChooseOpt, onTypeInput, onTypeSubmit, onDontKnow } = props;
  const pct = Math.max(3, Math.round(((qIdx + 1) / totalQueue) * 100));

  container.innerHTML = `
    <div class="row-between gap-12 kr-topbar">
      <div class="grow kr-prog-wrap">
        <div class="row kr-title-row">
          <span class="kr-title">ĐỌC KANJI</span>
          <span class="kr-count-badge">Câu ${qIdx + 1}/${totalQueue}</span>
          ${q.isRetry ? `<span class="kr-retry-badge">Ôn lại</span>` : ''}
        </div>
        <div class="kr-prog-track"><div class="kr-prog-fill" style="--p:${pct}"></div></div>
      </div>
      <div class="row kr-controls">
        <button type="button" class="btn btn-sm kr-mode-sw ${inputMode === 'mcq' ? 'btn-teal' : ''}" data-m="mcq">🔘 Trắc nghiệm</button>
        <button type="button" class="btn btn-sm kr-mode-sw ${inputMode === 'type' ? 'btn-teal' : ''}" data-m="type">⌨️ Tự gõ Kana</button>
        <button type="button" id="kr-mute" class="btn btn-icon btn-yellow" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
        <button type="button" id="kr-quit" class="btn btn-icon kr-quit-btn" title="Thoát">⏻</button>
      </div>
    </div>

    <div class="study-split">
      <div class="study-left">
        <div class="card study-card-match kr-panel">
          <div class="row mb-12 kr-prompt-head">
            <span class="chip kr-mode-chip">${inputMode === 'mcq' ? 'Nhận diện' : 'Tự nhớ chủ động'}</span>
            <span class="text-base text-muted">${inputMode === 'mcq' ? 'Chọn cách đọc đúng' : 'Gõ cách đọc của từ này'}</span>
          </div>
          <div class="jp center kr-prompt-box">${formatPromptJP(q.word.jp)}</div>
        </div>
      </div>

      <div class="study-right">
        ${renderAnswerArea(q, inputMode, currentAnim)}
        ${renderExplain(q, qIdx, totalQueue, currentAnim)}
      </div>
    </div>
  `;

  container.querySelector('#kr-mute').onclick = onToggleSound;
  container.querySelector('#kr-quit').onclick = onExit;
  container.querySelectorAll('.kr-mode-sw').forEach((b) => { b.onclick = () => onSwitchMode(b.dataset.m); });
  container.querySelector('#kr-speak')?.addEventListener('click', onSpeak);
  container.querySelector('#kr-next')?.addEventListener('click', onNext);

  if (inputMode === 'mcq') {
    container.querySelectorAll('.kr-opt').forEach((btn) => { btn.onclick = () => onChooseOpt(Number(btn.dataset.i)); });
  } else {
    const inp = container.querySelector('#kr-type-inp');
    if (inp && !q.answered) {
      inp.focus();
      inp.onkeydown = (e) => {
        if (e.key === '?' || (e.shiftKey && e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); onDontKnow(); }
      };
      inp.oninput = () => {
        const converted = onTypeInput(inp.value);
        if (converted !== inp.value) inp.value = converted;
      };
    }
    container.querySelector('#kr-type-form')?.addEventListener('submit', (e) => { e.preventDefault(); onTypeSubmit(inp?.value || ''); });
    container.querySelector('#kr-dont-know')?.addEventListener('click', onDontKnow);
  }
}