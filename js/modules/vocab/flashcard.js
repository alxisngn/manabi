import { getStore, updateStore } from '../../core/store.js';
import { escapeHtml } from '../../core/util.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';

const STORE_KEY = 'vocab';
const POS_LABELS = { verb: 'Động từ', noun: 'Danh từ', adj: 'Tính từ', adv: 'Trạng từ', other: 'Từ vựng' };
const isSameWord = (a, b) => a && b && a.jp === b.jp && a.vi === b.vi;

export function mountFlashcard(container, words = [], onBack) {
  if (!Array.isArray(words) || words.length === 0) return onBack && onBack();

  let index = 0, flipped = false, touchStartX = 0, touchStartY = 0;

  const isBookmarked = (word) => (getStore(STORE_KEY, { weakWords: [] }).weakWords || []).some((w) => isSameWord(w, word));

  function toggleBookmark(word) {
    updateStore(STORE_KEY, (cur) => {
      const list = Array.isArray(cur.weakWords) ? [...cur.weakWords] : [];
      const idx = list.findIndex((w) => isSameWord(w, word));
      if (idx >= 0) list.splice(idx, 1); else list.push(word);
      return { ...cur, weakWords: list };
    }, { weakWords: [] });
  }

  function render() {
    const word = words[index];
    const total = words.length;
    const progressPct = Math.max(4, Math.round(((index + 1) / total) * 100));
    const saved = isBookmarked(word);
    const posText = POS_LABELS[word.pos] || '';

    const centerContent = !flipped
      ? `<div class="jp" style="font-size:clamp(2.1rem,7vw,3rem);font-weight:700;text-align:center;word-break:break-word;padding:24px 8px;">${escapeHtml(word.jp)}</div>`
      : `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:10px 4px;width:100%;">
          <div class="jp" style="font-size:1.75rem;font-weight:700;color:var(--text);">${escapeHtml(word.jp)}</div>
          ${word.reading && word.reading !== word.jp ? `<div class="jp" style="font-size:1.1rem;color:var(--teal);font-weight:500;">${escapeHtml(word.reading)}</div>` : ''}
          ${posText ? `<span style="font-size:0.78rem;padding:2px 10px;border-radius:999px;background:var(--bg-elevated);border:1.5px solid var(--border);color:var(--text-muted);">${escapeHtml(posText)}</span>` : ''}
          <div style="font-size:1.35rem;font-weight:800;color:var(--yellow);margin-top:2px;">${escapeHtml(word.vi)}</div>
          ${word.ex ? `<div style="margin-top:10px;padding-top:10px;border-top:1.5px dashed var(--border);width:100%;text-align:left;"><div class="jp" style="font-size:1.02rem;line-height:1.75;color:var(--text);">${parseRuby(word.ex)}</div>${word.exVi ? `<div style="font-size:0.9rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(word.exVi)}</div>` : ''}</div>` : ''}
        </div>`;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <button type="button" id="fc-back" class="btn">← Chế độ học</button>
        <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">Vuốt trái/phải để chuyển</span>
      </div>
      <div id="fc-card" class="card" style="min-height:330px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;user-select:none;position:relative;padding:20px;box-shadow:6px 7px 0 var(--shadow);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span style="padding:4px 14px;border-radius:999px;font-size:0.85rem;font-weight:700;border:2px solid var(--teal);color:var(--teal);background:rgba(91,192,190,0.1);">${flipped ? 'Mặt sau' : 'Mặt trước'}</span>
          <button type="button" id="fc-bookmark" class="btn btn-icon" title="Lưu vào Từ cần ôn lại" aria-label="Lưu từ" style="width:44px;height:44px;border-radius:14px;background:${saved ? 'rgba(245,200,79,0.18)' : 'var(--bg-elevated)'};border-color:${saved ? 'var(--yellow)' : 'var(--border)'};color:${saved ? 'var(--yellow)' : 'var(--text)'};">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </button>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;">${centerContent}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;display:inline-flex;align-items:center;gap:6px;">↻ Bấm vào thẻ để lật</span>
          <button type="button" id="fc-speak" class="btn" style="border-radius:999px;padding:6px 14px 6px 6px;min-height:44px;background:var(--bg-elevated);gap:8px;">
            <span style="width:32px;height:32px;border-radius:50%;background:#CBECEB;color:#101320;display:inline-flex;align-items:center;justify-content:center;">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </span>
            <span style="font-size:0.95rem;font-weight:700;">Nghe</span>
          </button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:20px;">
        <button type="button" id="fc-prev" class="btn btn-icon" style="width:52px;height:52px;border-radius:16px;" ${index === 0 ? 'disabled' : ''} aria-label="Từ trước"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div style="font-size:1.05rem;font-weight:800;"><span style="color:var(--text);font-size:1.3rem;">${index + 1}</span><span style="color:var(--text-muted);"> / ${total}</span></div>
          <div style="width:100%;max-width:260px;height:12px;background:var(--bg-card);border:2px solid var(--border);border-radius:999px;overflow:hidden;padding:1px;"><div style="width:${progressPct}%;height:100%;background:#187E78;border-radius:999px;transition:width 0.2s ease;"></div></div>
        </div>
        <button type="button" id="fc-next" class="btn btn-icon btn-yellow" style="width:52px;height:52px;border-radius:16px;" ${index === total - 1 ? 'disabled' : ''} aria-label="Từ tiếp theo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
      </div>
    `;

    const cardEl = container.querySelector('#fc-card');
    cardEl.onclick = () => { flipped = !flipped; render(); };
    container.querySelector('#fc-bookmark').onclick = (e) => { e.stopPropagation(); toggleBookmark(word); render(); };
    container.querySelector('#fc-speak').onclick = (e) => { e.stopPropagation(); speakJP(word.reading || word.jp); };
    container.querySelector('#fc-prev').onclick = () => { if (index > 0) { index--; flipped = false; render(); } };
    container.querySelector('#fc-next').onclick = () => { if (index < total - 1) { index++; flipped = false; render(); } };
    container.querySelector('#fc-back').onclick = () => onBack && onBack();
    cardEl.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }, { passive: true });
    cardEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX, dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0 && index < total - 1) { index++; flipped = false; render(); }
        else if (dx > 0 && index > 0) { index--; flipped = false; render(); }
      }
    }, { passive: true });
  }

  render();
}