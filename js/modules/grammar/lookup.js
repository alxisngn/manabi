import { stripRuby } from '../../core/ruby.js';
import { escapeHtml } from '../../core/util.js';

const vocabCache = new Map();
const dictCache = new Map();
const JA_RX = /[\u3040-\u30ff\u4e00-\u9faf]/;

async function loadVocabPool(level) {
  const lv = String(level || 'N4').toLowerCase();
  if (vocabCache.has(lv)) return vocabCache.get(lv);

  const pool = [];
  try {
    const idxRes = await fetch(`data/${lv}/vocab/index.json`);
    if (idxRes.ok) {
      const lessons = (await idxRes.json())?.lessons || [];
      const files = await Promise.all(
        lessons.map((l) => fetch(`data/${lv}/vocab/${l.file}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
      );
      files.forEach((data, idx) => {
        const lessonName = lessons[idx]?.name || '';
        (data?.words || []).forEach((w) => {
          pool.push({
            jp: stripRuby(w.jp || ''),
            reading: w.reading || '',
            vi: w.vi || '',
            lessonName
          });
        });
      });
    }
  } catch {}

  vocabCache.set(lv, pool);
  return pool;
}

async function queryJotoba(query) {
  if (dictCache.has(query)) return dictCache.get(query);
  try {
    const res = await fetch('https://jotoba.de/api/search/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, language: 'English', no_english: false })
    });
    if (!res.ok) return null;
    const words = (await res.json())?.words || [];
    if (!words.length) {
      dictCache.set(query, null);
      return null;
    }
    const top = words[0];
    const headword = top.reading?.kanji || top.reading?.kana || query;
    const kana = top.reading?.kana || '';
    const senses = (top.senses || []).slice(0, 2).map((s) => (s.glosses || []).slice(0, 3).join(', ')).filter(Boolean);
    const jlpt = Array.isArray(top.jlpt) && top.jlpt.length ? top.jlpt[0].toUpperCase() : '';
    const item = { jp: headword, reading: kana, meaning: senses.join(' • '), jlpt };
    dictCache.set(query, item);
    return item;
  } catch {
    return null;
  }
}

function getCleanSelection(container) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return '';
  const frag = range.cloneContents();
  frag.querySelectorAll('rt').forEach((rt) => rt.remove());
  const text = (frag.textContent || '').replace(/\s+/g, '').trim();
  if (!text || text.length > 18 || !JA_RX.test(text)) return '';
  return text;
}

export function attachSelectionLookup(container, level) {
  let box = null;
  let timer = null;
  let reqToken = 0;

  function closeBox() {
    if (box) {
      box.remove();
      box = null;
    }
  }

  function renderPopup(innerHtml) {
    closeBox();
    box = document.createElement('div');
    box.className = 'card gr-lookup';
    box.innerHTML = innerHtml;
    box.querySelector('[data-close-lk]')?.addEventListener('click', closeBox);
    container.appendChild(box);
  }

  async function showLookup(query) {
    const token = ++reqToken;
    const pool = await loadVocabPool(level);
    if (!document.body.contains(container) || token !== reqToken) return;

    const exact = pool.find((w) => w.jp === query || w.reading === query);
    const localHit = exact || pool.find((w) => w.jp.includes(query) || query.includes(w.jp));
    const maziiUrl = `https://mazii.net/vi-VN/search/word/javi/${encodeURIComponent(query)}`;

    if (localHit) {
      renderPopup(`
        <div class="gr-lookup-head">
          <div>
            <span class="gr-lookup-word jp">${escapeHtml(localHit.jp)}</span>
            ${localHit.reading && localHit.reading !== localHit.jp ? `<span class="gr-lookup-read jp">(${escapeHtml(localHit.reading)})</span>` : ''}
          </div>
          <button type="button" class="btn gr-pill" data-close-lk="1">✕</button>
        </div>
        <div class="gr-lookup-vi">${escapeHtml(localHit.vi)}</div>
        <div class="gr-lookup-actions">
          <span class="badge badge-ready">Kho từ vựng${localHit.lessonName ? ` • ${escapeHtml(localHit.lessonName)}` : ''}</span>
          <a href="${maziiUrl}" target="_blank" rel="noopener" class="btn gr-pill">Mazii ↗</a>
        </div>`);
      return;
    }

    renderPopup(`
      <div class="gr-lookup-head">
        <span class="gr-lookup-word jp">🔍 ${escapeHtml(query)}</span>
        <button type="button" class="btn gr-pill" data-close-lk="1">✕</button>
      </div>
      <div class="gr-lookup-sub">Đang tra từ điển...</div>`);

    const remote = await queryJotoba(query);
    if (!document.body.contains(container) || token !== reqToken) return;

    if (remote && remote.meaning) {
      renderPopup(`
        <div class="gr-lookup-head">
          <div>
            <span class="gr-lookup-word jp">${escapeHtml(remote.jp)}</span>
            ${remote.reading && remote.reading !== remote.jp ? `<span class="gr-lookup-read jp">(${escapeHtml(remote.reading)})</span>` : ''}
          </div>
          <button type="button" class="btn gr-pill" data-close-lk="1">✕</button>
        </div>
        <div class="gr-lookup-vi">${escapeHtml(remote.meaning)}</div>
        <div class="gr-lookup-actions">
          <span class="badge">${remote.jlpt ? `${escapeHtml(remote.jlpt)} • ` : ''}Từ điển mở</span>
          <a href="${maziiUrl}" target="_blank" rel="noopener" class="btn gr-pill">Mazii ↗</a>
        </div>`);
      return;
    }

    renderPopup(`
      <div class="gr-lookup-head">
        <span class="gr-lookup-word jp">🔍 ${escapeHtml(query)}</span>
        <button type="button" class="btn gr-pill" data-close-lk="1">✕</button>
      </div>
      <div class="gr-lookup-actions">
        <span class="gr-lookup-sub">Không tìm thấy từ khớp</span>
        <a href="${maziiUrl}" target="_blank" rel="noopener" class="btn btn-yellow gr-pill">Tra Mazii ↗</a>
      </div>`);
  }

  const onSelect = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!document.body.contains(container)) {
        document.removeEventListener('selectionchange', onSelect);
        return;
      }
      const q = getCleanSelection(container);
      if (q) showLookup(q);
    }, 280);
  };

  document.addEventListener('selectionchange', onSelect);
}