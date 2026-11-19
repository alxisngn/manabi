import { escapeHtml } from '../../core/util.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';
import { isWeak, addWeak, removeWeak } from '../../core/weak.js';
import { romajiToContextKana, isKanaMatch, normalizeKana, toHiraganaChar } from '../../core/kana.js';

export function mountKanjiType(container, words = [], onBack) {
  if (!Array.isArray(words) || words.length === 0) return onBack && onBack();

  let index = 0;
  let blurHint = false;
  let revealed = false;
  let val = '';
  let status = 'idle'; // 'idle' | 'ok' | 'err'
  let advanceTimer = null;

  const clearTimer = () => {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  };

  const goTo = (nextIdx) => {
    clearTimer();
    if (nextIdx < 0 || nextIdx >= words.length) return;
    index = nextIdx;
    revealed = false;
    val = '';
    status = 'idle';
    render();
  };

  const checkMatch = (rawInput, word) => {
    const clean = String(rawInput || '').trim();
    if (!clean) return false;
    if (clean === String(word.jp || '').trim()) return true;
    const flushed = romajiToContextKana(clean, true, word.reading || word.jp || '');
    return isKanaMatch(flushed, word, { includeJp: true });
  };

  function handleSuccess(word) {
    if (status === 'ok') return;
    status = 'ok';
    revealed = true;
    speakJP(word.reading || word.jp);
    render();
    if (index < words.length - 1) {
      advanceTimer = setTimeout(() => goTo(index + 1), 650);
    }
  }

  function render() {
    if (!document.body.contains(container)) {
      clearTimer();
      return;
    }

    const word = words[index];
    const total = words.length;
    const progressPct = Math.max(4, Math.round(((index + 1) / total) * 100));
    const saved = isWeak(word);
    const targetReading = word.reading || word.jp || '';
    const isHidden = blurHint && !revealed && status !== 'ok';

    const blurStyle = isHidden
      ? 'filter:blur(7px);opacity:0.45;user-select:none;cursor:pointer;'
      : 'transition:filter .18s ease,opacity .18s ease;';

    const borderStyle = status === 'ok'
      ? 'border-color:var(--teal);box-shadow:0 0 0 2px rgba(93,211,198,.25);'
      : status === 'err'
        ? 'border-color:var(--coral);'
        : '';

    container.innerHTML = `
      <div class="row-between mb-12">
        <button type="button" id="kt-back" class="btn">← Chế độ học</button>
        <button type="button" id="kt-blur-toggle" class="btn btn-sm ${blurHint ? 'btn-yellow' : ''}">
          ${blurHint ? '🙈 Che (Chạm để xem)' : '👁️ Gợi ý: Hiện mờ'}
        </button>
      </div>

      <div class="card col gap-12" style="padding:20px 18px;">
        <div class="row-between">
          <span class="fc-side-tag">Học qua gõ phím</span>
          <div class="row gap-8">
            <button type="button" id="kt-speak" class="btn btn-sm" title="Nghe phát âm">🔊 Nghe</button>
            <button type="button" id="kt-bookmark" class="btn btn-icon fc-bookmark-btn ${saved ? 'is-saved' : ''}" title="Lưu vào Từ cần ôn lại">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </button>
          </div>
        </div>

        <div class="center col" style="padding:12px 0 4px;text-align:center;">
          <div class="jp" style="font-size:clamp(2.4rem,8vw,3.4rem);font-weight:800;line-height:1.25;">${escapeHtml(word.jp)}</div>
          <div id="kt-hint-box" style="margin-top:10px;display:flex;flex-direction:column;align-items:center;gap:4px;${blurStyle}" title="${isHidden ? 'Chạm để hé lộ gợi ý' : ''}">
            ${targetReading !== word.jp ? `<div class="jp" style="font-size:1.25rem;color:var(--teal);font-weight:600;letter-spacing:.04em;">${escapeHtml(targetReading)}</div>` : ''}
            <div style="font-size:1rem;color:var(--text-muted);">${escapeHtml(word.vi)}</div>
          </div>
        </div>

        <div class="col gap-8">
          <div style="position:relative;">
            <input
              type="text"
              id="kt-inp"
              class="inp jp"
              value="${escapeHtml(val)}"
              placeholder="${isHidden ? 'Gõ cách đọc (chạm vùng mờ ở trên nếu quên)...' : `Gõ theo: ${targetReading}`}"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              lang="ja"
              style="font-size:1.2rem;text-align:center;padding:13px 14px;${borderStyle}"
            />
          </div>
          <div class="row-between text-sm">
            <span class="${status === 'ok' ? 'text-teal' : status === 'err' ? 'pk-err' : 'text-muted'}">
              ${status === 'ok'
                ? (index === total - 1 ? '✓ Hoàn thành tất cả từ trong bài!' : '✓ Chính xác! Đang sang từ tiếp theo...')
                : status === 'err'
                  ? 'Chưa khớp — kiểm tra lại trường âm / biến âm nhé'
                  : 'Gõ Romaji tự đổi sang Hiragana ngay lập tức'}
            </span>
            <button type="button" id="kt-check" class="btn btn-sm ${status === 'ok' ? 'btn-teal' : 'btn-yellow'}">
              ${status === 'ok' ? (index === total - 1 ? 'Xong ✓' : 'Tiếp →') : 'Kiểm tra'}
            </button>
          </div>
        </div>

        ${(status === 'ok' && word.ex) ? `
          <div class="w-full fc-ex-box" style="margin-top:4px;">
            <div class="jp fc-ex-jp">${parseRuby(word.ex)}</div>
            ${word.exVi ? `<div class="fc-ex-vi">${escapeHtml(word.exVi)}</div>` : ''}
          </div>` : ''}
      </div>

      <div class="row-between fc-nav">
        <button type="button" id="kt-prev" class="btn btn-icon fc-nav-btn" ${index === 0 ? 'disabled' : ''} aria-label="Từ trước">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="grow fc-prog-col">
          <div class="fc-counter"><span class="fc-counter-cur">${index + 1}</span><span class="fc-counter-tot"> / ${total}</span></div>
          <div class="w-full fc-prog-track"><div class="fc-prog-fill" style="--p:${progressPct}"></div></div>
        </div>
        <button type="button" id="kt-next" class="btn btn-icon btn-yellow fc-nav-btn" ${index === total - 1 ? 'disabled' : ''} aria-label="Từ tiếp theo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    `;

    const inp = container.querySelector('#kt-inp');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);

      const syncInputValue = (forceFlush = false) => {
        const raw = inp.value;
        // Chỉ chuyển Romaji -> Hiragana khi chuỗi có chữ cái Latin (tránh can thiệp IME Kanji/Kana đang gõ)
        if (/[a-zA-Z'-]/.test(raw)) {
          const converted = toHiraganaChar(romajiToContextKana(raw, forceFlush, targetReading));
          if (converted !== raw) {
            inp.value = converted;
          }
        }
        val = inp.value;
        if (status === 'err') status = 'idle';

        if (checkMatch(val, word)) {
          inp.value = toHiraganaChar(romajiToContextKana(inp.value, true, targetReading));
          val = inp.value;
          handleSuccess(word);
        }
      };

      inp.oninput = (e) => {
        // Nếu đang dùng IME tiếng Nhật (chữ Kana/Kanji đang gạch chân) thì đợi compositionend
        if (e.isComposing && !/^[a-zA-Z0-9\u3040-\u309F'-]+$/.test(inp.value)) {
          val = inp.value;
          return;
        }
        syncInputValue(false);
      };

      inp.addEventListener('compositionend', () => {
        syncInputValue(false);
      });

      inp.onkeydown = (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          if (status === 'ok') {
            if (index < total - 1) goTo(index + 1);
            else onBack && onBack();
            return;
          }
          syncInputValue(true);
          if (status !== 'ok' && normalizeKana(val)) {
            status = 'err';
            render();
          }
        }
      };
    }

    container.querySelector('#kt-hint-box')?.addEventListener('click', () => {
      if (isHidden) {
        revealed = true;
        render();
      }
    });

    container.querySelector('#kt-blur-toggle')?.addEventListener('click', () => {
      blurHint = !blurHint;
      revealed = false;
      render();
    });

    container.querySelector('#kt-check')?.addEventListener('click', () => {
      if (status === 'ok') {
        if (index < total - 1) goTo(index + 1);
        else onBack && onBack();
        return;
      }
      const flushed = toHiraganaChar(romajiToContextKana(val, true, targetReading));
      val = flushed;
      if (checkMatch(val, word)) handleSuccess(word);
      else {
        status = 'err';
        render();
      }
    });

    container.querySelector('#kt-speak')?.addEventListener('click', () => speakJP(word.reading || word.jp));
    container.querySelector('#kt-bookmark')?.addEventListener('click', () => {
      if (isWeak(word)) removeWeak(word);
      else addWeak(word);
      render();
    });
    container.querySelector('#kt-prev')?.addEventListener('click', () => goTo(index - 1));
    container.querySelector('#kt-next')?.addEventListener('click', () => goTo(index + 1));
    container.querySelector('#kt-back')?.addEventListener('click', () => {
      clearTimer();
      onBack && onBack();
    });
  }

  render();
}