import { escapeHtml } from '../../../core/util.js';
import { isSameWord } from '../../../core/weak.js';

const BADGE_COLORS = ['#18B899', '#F5C84F', '#F08F7A', '#8AE1DF', '#A78BFA', '#F472B6'];

function formatPromptJP(jp) {
  const escaped = escapeHtml(jp);
  return escaped.replace(
    /^(「[^」]+」)\s*(.+)$/,
    '<span style="font-size:0.72em;color:var(--text-muted);font-weight:600;">$1</span> <span style="display:inline-block;">$2</span>'
  );
}

export function renderMcq(q, currentAnim, explainHtml) {
  const isViJp = q.dir === 'vi-jp';
  const optsHtml = q.options.map((opt, i) => {
    const isAns = isSameWord(opt, q.word);
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

  return `
    <div class="study-split">
      <div class="study-left">
        <div class="card" style="padding:16px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
            <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--teal);color:var(--teal);background:rgba(91,192,190,0.12);">${isViJp ? 'Việt → Nhật' : 'Nhật → Việt'}</span>
            <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${isViJp ? 'Chọn từ tiếng Nhật tương ứng' : 'Hãy chọn nghĩa đúng'}</span>
          </div>
          <div class="${isViJp ? '' : 'jp'}" style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:16px;padding:34px 14px;text-align:center;font-size:${isViJp ? 'clamp(1.35rem,4vw,1.9rem)' : 'clamp(1.65rem,3.4vw,2.4rem)'};font-weight:700;word-break:keep-all;overflow-wrap:break-word;">${isViJp ? escapeHtml(q.word.vi) : formatPromptJP(q.word.jp)}</div>
        </div>
      </div>
      <div class="study-right">
        <div class="qz-grid">${optsHtml}</div>
        ${explainHtml}
      </div>
    </div>`;
}

export function renderTf(q, currentAnim, explainHtml) {
  const btnStyle = (val) => {
    let bd = 'var(--border)', bg = 'var(--bg-card)';
    if (q.answered) { if (val === q.isMatch) { bd = 'var(--green)'; bg = 'rgba(76,175,106,0.2)'; } else if (val === q.chosenVal) { bd = 'var(--red)'; bg = 'rgba(217,72,59,0.22)'; } }
    return `border-color:${bd};background:${bg};`;
  };
  return `
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