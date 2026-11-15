import { escapeHtml } from '../../../core/util.js';
import { isSameWord } from '../../../core/weak.js';

export function renderPairs(q, explainHtml) {
  const rowsHtml = q.left.map((lw, i) => {
    const rw = q.right[i], lM = q.matchedIds.includes(lw.jp), rM = q.matchedIds.includes(rw.jp), lS = q.selLeft === i, rS = q.selRight === i, lW = q.wrongLeftIdx === i, rW = q.wrongRightIdx === i;
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><button type="button" class="qz-m-left ${lW ? 'anim-shake' : ''}" data-i="${i}" ${lM || q.answered ? 'disabled' : ''} style="min-height:48px;padding:8px;border-radius:12px;border:2px solid ${lW ? 'var(--red)' : lM ? 'var(--green)' : lS ? 'var(--teal)' : 'var(--border)'};background:${lW ? 'rgba(217,72,59,0.25)' : lM ? 'rgba(76,175,106,0.22)' : lS ? 'rgba(91,192,190,0.2)' : 'var(--bg-elevated)'};color:var(--text);font-family:var(--font-jp);font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span>${escapeHtml(lw.jp)}</span></button><button type="button" class="qz-m-right ${rW ? 'anim-shake' : ''}" data-i="${i}" ${rM || q.answered ? 'disabled' : ''} style="min-height:48px;padding:8px;border-radius:12px;border:2px solid ${rW ? 'var(--red)' : rM ? 'var(--green)' : rS ? 'var(--teal)' : '#574F35'};background:${rW ? 'rgba(217,72,59,0.25)' : rM ? 'rgba(76,175,106,0.22)' : rS ? 'rgba(91,192,190,0.2)' : '#2A261B'};color:var(--text);font-family:var(--font-ui);font-size:0.92rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span>${escapeHtml(rw.vi)}</span></button></div>`;
  }).join('');
  return `
    <div class="card" style="padding:14px;max-width:680px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;"><div style="display:flex;align-items:center;gap:8px;"><span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--border);color:var(--text);background:var(--bg-elevated);">Nối cặp</span><span style="font-size:0.86rem;color:var(--text-muted);font-weight:600;">Chọn bên nào trước cũng được</span></div><span id="qz-m-count" style="font-weight:800;font-size:0.88rem;">${q.matchedIds.length} / ${q.weight} cặp</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div>
      ${explainHtml}
    </div>`;
}

export function syncMatchUI(container, q, doneBefore, total) {
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
}

export function bindPairs(container, q, { doneBefore, total, maybeSpeak, onPairMatch, recordWrong, onAllMatched }) {
  const sync = () => syncMatchUI(container, q, doneBefore, total);

  const checkMatchPair = (lIdx, rIdx) => {
    const lw = q.left[lIdx], rw = q.right[rIdx];
    if (isSameWord(lw, rw)) {
      q.matchedIds.push(lw.jp);
      q.selLeft = -1;
      q.selRight = -1;
      if (!q.mistakeIds.includes(lw.jp)) onPairMatch(lw);
      if (q.matchedIds.length === q.left.length) {
        q.answered = true;
        q.correct = q.mistakeIds.length === 0;
        onAllMatched(q.correct);
      } else {
        sync();
      }
    } else {
      if (!q.mistakeIds.includes(lw.jp)) q.mistakeIds.push(lw.jp);
      q.wrongLeftIdx = lIdx;
      q.wrongRightIdx = rIdx;
      recordWrong(lw);
      sync();
      setTimeout(() => {
        q.wrongLeftIdx = -1;
        q.wrongRightIdx = -1;
        q.selLeft = -1;
        q.selRight = -1;
        sync();
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
      sync();
    };
  });

  container.querySelectorAll('.qz-m-right').forEach((btn) => {
    btn.onclick = () => {
      const rIdx = Number(btn.dataset.i);
      q.wrongLeftIdx = -1;
      q.wrongRightIdx = -1;
      if (q.selLeft >= 0) return checkMatchPair(q.selLeft, rIdx);
      q.selRight = q.selRight === rIdx ? -1 : rIdx;
      sync();
    };
  });
}