import { escapeHtml } from '../../../core/util.js';
import { STRIP_PUNCT, romajiToContextKana, isKanaMatch } from '../../../core/kana.js';

export function renderTyping(q, currentAnim, explainHtml) {
  const bd = q.answered ? (q.correct ? 'var(--green)' : 'var(--red)') : 'var(--teal)';
  const inpAnim = q.answered ? currentAnim : '';
  return `
    <div class="study-split">
      <div class="study-left">
        <div class="card study-card-match" style="padding:18px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
            <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--coral);color:var(--coral);background:rgba(240,143,122,0.12);">Việt → Nhật</span>
            <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">Gõ lại từ tiếng Nhật tương ứng</span>
          </div>
          <div style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:16px;padding:34px 16px;text-align:center;font-size:clamp(1.35rem,3.2vw,1.95rem);font-weight:800;color:var(--text);">
            ${escapeHtml(q.word.vi)}
          </div>
        </div>
      </div>
      <div class="study-right">
        <div class="card study-card-match" style="padding:18px;">
          <div style="font-size:0.86rem;color:var(--text-muted);font-weight:700;margin-bottom:10px;">Nhập từ tiếng Nhật (Romaji → Hiragana / Katakana)</div>
          <form id="qz-type-form" style="display:flex;flex-direction:column;gap:12px;">
            <input type="text" id="qz-type-inp" class="jp kr-inp ${inpAnim}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              placeholder="Gõ romaji (vd: kamimasu)..."
              value="${escapeHtml(q.typedVal || '')}" ${q.answered ? 'disabled' : ''}
              style="width:100%;min-height:60px;padding:10px 14px;border-radius:14px;border:2.5px solid ${bd};background:var(--bg-elevated);color:var(--text);font-size:1.45rem;font-weight:700;text-align:center;">
            ${!q.answered ? `
              <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:8px;">
                <button type="submit" class="btn btn-teal" style="font-size:1rem;">Kiểm tra <span class="kbd-hint">Enter ↵</span></button>
                <button type="button" id="qz-dont-know" class="btn" style="font-size:0.95rem;">Không nhớ <span class="kbd-hint">Shift ↵</span></button>
              </div>` : ''}
          </form>
        </div>
        ${explainHtml}
      </div>
    </div>`;
}

export function handleTypingKeyDown(e, container) {
  if (e.key === '?' || (e.shiftKey && e.key === 'Enter')) {
    e.preventDefault();
    container.querySelector('#qz-dont-know')?.click();
  }
}

export function bindTyping(container, q, { onCorrect, recordWrong, renderPlay }) {
  const inp = container.querySelector('#qz-type-inp');
  const targetHint = q.word.reading || q.word.jp;
  if (inp && !q.answered) {
    inp.focus();
    inp.onkeydown = (e) => {
      if (e.key === '?' || (e.shiftKey && e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        container.querySelector('#qz-dont-know')?.click();
      }
    };
    inp.oninput = () => {
      const converted = romajiToContextKana(inp.value, false, targetHint);
      if (converted !== inp.value) inp.value = converted;
      q.typedVal = inp.value;
    };
  }
  container.querySelector('#qz-type-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (q.answered) return;
    const displayKana = romajiToContextKana(inp?.value || '', true, targetHint).replace(STRIP_PUNCT, '');
    if (!displayKana) return;
    q.typedVal = displayKana;
    q.answered = true;
    q.correct = isKanaMatch(inp?.value || '', q.word, { includeJp: true });
    if (q.correct) onCorrect(q); else recordWrong(q.word);
    renderPlay();
  });
  container.querySelector('#qz-dont-know')?.addEventListener('click', () => {
    if (q.answered) return;
    q.typedVal = '(Bỏ qua)';
    q.answered = true;
    q.correct = false;
    recordWrong(q.word);
    renderPlay();
  });
}