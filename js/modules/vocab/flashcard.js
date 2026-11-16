import { escapeHtml } from '../../core/util.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';
import { isWeak, addWeak, removeWeak } from '../../core/weak.js';

const POS_LABELS = { verb: 'Động từ', noun: 'Danh từ', adj: 'Tính từ', adv: 'Trạng từ', other: 'Từ vựng' };

export function mountFlashcard(container, words = [], onBack) {
  if (!Array.isArray(words) || words.length === 0) return onBack && onBack();
const onFlashKey = (e) => {
    if (!document.body.contains(container)) return document.removeEventListener('keydown', onFlashKey);
    if (document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const cardEl = container.querySelector('.flashcard, .fc-card, [data-flashcard], #fc-card, #flashcard');
      if (cardEl) cardEl.click();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const btns = [...container.querySelectorAll('button')];
      const nextBtn = container.querySelector('#fc-next, [data-action="next"]') || btns.find((b) => /tiếp|sau|→|›/i.test(b.textContent));
      nextBtn?.click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const btns = [...container.querySelectorAll('button')];
      const prevBtn = container.querySelector('#fc-prev, [data-action="prev"]') || btns.find((b) => /trước|lùi|←|‹/i.test(b.textContent) && !/đổi|chế độ|quay/i.test(b.textContent));
      prevBtn?.click();
    } else if (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'r') {
      const btns = [...container.querySelectorAll('button')];
      const speakBtn = container.querySelector('#fc-speak, [data-action="speak"]') || btns.find((b) => /🔊|nghe/i.test(b.textContent));
      speakBtn?.click();
    }
  };
  document.addEventListener('keydown', onFlashKey);
  let index = 0, flipped = false, touchStartX = 0, touchStartY = 0;

  function render() {
    const word = words[index];
    const total = words.length;
    const progressPct = Math.max(4, Math.round(((index + 1) / total) * 100));
    const saved = isWeak(word);
    const posText = POS_LABELS[word.pos] || '';

    const centerContent = !flipped
      ? `<div class="jp center fc-front-jp">${escapeHtml(word.jp)}</div>`
      : `<div class="center w-full fc-back-wrap">
          <div class="jp fc-back-jp">${escapeHtml(word.jp)}</div>
          ${word.reading && word.reading !== word.jp ? `<div class="jp fc-back-reading">${escapeHtml(word.reading)}</div>` : ''}
          ${posText ? `<span class="fc-pos-pill">${escapeHtml(posText)}</span>` : ''}
          <div class="fc-back-vi">${escapeHtml(word.vi)}</div>
          ${word.ex ? `<div class="w-full fc-ex-box"><div class="jp fc-ex-jp">${parseRuby(word.ex)}</div>${word.exVi ? `<div class="fc-ex-vi">${escapeHtml(word.exVi)}</div>` : ''}</div>` : ''}
        </div>`;

    container.innerHTML = `
      <div class="row-between mb-12">
        <button type="button" id="fc-back" class="btn">← Chế độ học</button>
        <span class="text-base text-muted">Vuốt trái/phải để chuyển</span>
      </div>
      <div id="fc-card" class="card fc-card">
        <div class="row-between fc-head">
          <span class="fc-side-tag">${flipped ? 'Mặt sau' : 'Mặt trước'}</span>
          <button type="button" id="fc-bookmark" class="btn btn-icon fc-bookmark-btn ${saved ? 'is-saved' : ''}" title="Lưu vào Từ cần ôn lại" aria-label="Lưu từ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </button>
        </div>
        <div class="grow fc-body">${centerContent}</div>
        <div class="row-between fc-foot">
          <span class="text-base text-muted fc-flip-hint">↻ Bấm vào thẻ để lật</span>
          <button type="button" id="fc-speak" class="btn fc-speak-btn">
            <span class="fc-speak-ico">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </span>
            <span class="fc-speak-lbl">Nghe</span>
          </button>
        </div>
      </div>
      <div class="row-between fc-nav">
        <button type="button" id="fc-prev" class="btn btn-icon fc-nav-btn" ${index === 0 ? 'disabled' : ''} aria-label="Từ trước"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
        <div class="grow fc-prog-col">
          <div class="fc-counter"><span class="fc-counter-cur">${index + 1}</span><span class="fc-counter-tot"> / ${total}</span></div>
          <div class="w-full fc-prog-track"><div class="fc-prog-fill" style="--p:${progressPct}"></div></div>
        </div>
        <button type="button" id="fc-next" class="btn btn-icon btn-yellow fc-nav-btn" ${index === total - 1 ? 'disabled' : ''} aria-label="Từ tiếp theo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
      </div>
    `;

    const cardEl = container.querySelector('#fc-card');
    cardEl.onclick = () => { flipped = !flipped; render(); };
    container.querySelector('#fc-bookmark').onclick = (e) => { e.stopPropagation(); if (isWeak(word)) removeWeak(word); else addWeak(word); render(); };
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