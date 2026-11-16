import { escapeHtml } from '../../../core/util.js';
import { isSameWord } from '../../../core/weak.js';

function formatPromptJP(jp) {
  const escaped = escapeHtml(jp);
  return escaped.replace(
    /^(「[^」]+」)\s*(.+)$/,
    '<span class="qz-prompt-prefix">$1</span> <span class="qz-prompt-word">$2</span>'
  );
}

export function renderMcq(q, currentAnim, explainHtml) {
  const isViJp = q.dir === 'vi-jp';
  const optsHtml = q.options.map((opt, i) => {
    const isAns = isSameWord(opt, q.word);
    let stateCls = '', animCls = '';
    if (q.answered) {
      if (isAns) { stateCls = 'is-correct'; if (i === q.chosenIdx) animCls = currentAnim; }
      else if (i === q.chosenIdx) { stateCls = 'is-wrong'; animCls = currentAnim; }
    }
    return `
      <button type="button" class="card qz-opt ${stateCls} ${animCls}" data-i="${i}" ${q.answered ? 'disabled' : ''}>
        <span class="qz-opt-num">${i + 1}</span>
        <span class="${isViJp ? 'jp' : ''} grow center qz-opt-txt ${isViJp ? 'is-jp' : ''}">${escapeHtml(isViJp ? opt.jp : opt.vi)}</span>
      </button>`;
  }).join('');

  return `
    <div class="study-split">
      <div class="study-left">
        <div class="card qz-prompt-card">
          <div class="row mb-12 qz-prompt-head">
            <span class="chip qz-chip-mcq">${isViJp ? 'Việt → Nhật' : 'Nhật → Việt'}</span>
            <span class="text-base text-muted">${isViJp ? 'Chọn từ tiếng Nhật tương ứng' : 'Hãy chọn nghĩa đúng'}</span>
          </div>
          <div class="${isViJp ? '' : 'jp'} center qz-prompt-box ${isViJp ? 'is-vi' : ''}">${isViJp ? escapeHtml(q.word.vi) : formatPromptJP(q.word.jp)}</div>
        </div>
      </div>
      <div class="study-right">
        <div class="qz-grid">${optsHtml}</div>
        ${explainHtml}
      </div>
    </div>`;
}

export function renderTf(q, currentAnim, explainHtml) {
  const tfState = (val) => {
    if (!q.answered) return '';
    if (val === q.isMatch) return 'is-correct';
    if (val === q.chosenVal) return 'is-wrong';
    return '';
  };
  return `
    <div class="study-split">
      <div class="study-left">
        <div class="card qz-prompt-card">
          <div class="row mb-12 qz-prompt-head"><span class="chip qz-chip-tf">Đúng / Sai</span><span class="text-base text-muted">Thuật ngữ và nghĩa dưới đây có khớp nhau không?</span></div>
          <div class="qz-tf-wrap">
            <div class="jp center qz-tf-jp">${escapeHtml(q.word.jp)}</div>
            <div class="qz-tf-eq">=</div>
            <div class="center qz-tf-vi">${escapeHtml(q.shownVi)}</div>
          </div>
        </div>
      </div>
      <div class="study-right">
        <div class="qz-grid">
          <button type="button" class="card qz-tf ${tfState(true)} ${q.answered && q.chosenVal === true ? currentAnim : ''}" data-v="true" ${q.answered ? 'disabled' : ''}><span class="qz-tf-ico is-true">✓</span><span class="qz-tf-lbl">Đúng <span class="kbd-hint">1</span></span></button>
          <button type="button" class="card qz-tf ${tfState(false)} ${q.answered && q.chosenVal === false ? currentAnim : ''}" data-v="false" ${q.answered ? 'disabled' : ''}><span class="qz-tf-ico is-false">✕</span><span class="qz-tf-lbl">Sai <span class="kbd-hint">2</span></span></button>
        </div>
        ${explainHtml}
      </div>
    </div>`;
}

export function bindChoice(container, q, { onCorrect, recordWrong, renderPlay }) {
  container.querySelectorAll('.qz-opt').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.i);
      q.chosenIdx = idx; q.answered = true; q.correct = isSameWord(q.options[idx], q.word);
      if (q.correct) onCorrect(q); else recordWrong(q.word);
      renderPlay();
    };
  });
  container.querySelectorAll('.qz-tf').forEach((btn) => {
    btn.onclick = () => {
      const val = btn.dataset.v === 'true';
      q.chosenVal = val; q.answered = true; q.correct = val === q.isMatch;
      if (q.correct) onCorrect(q); else recordWrong(q.word);
      renderPlay();
    };
  });
}