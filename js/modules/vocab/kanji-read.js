import { updateStore } from '../../core/store.js';
import { shuffle, pickN, escapeHtml } from '../../core/util.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';

const STORE_KEY = 'vocab';
const BADGE_COLORS = ['#18B899', '#F5C84F', '#F08F7A', '#8AE1DF'];
const HAS_KANJI = /[\u4E00-\u9FAF]/;
const KATAKANA_CHAR = /[\u30A1-\u30F6]/;
const STRIP_PUNCT = /[^\p{L}\p{N}ー]+/gu;

const DAKUTEN_MAP = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ぶ', べ: 'へ', ぼ: 'ほ'
};

const ROMAJI_TABLE = {
  ltsu: 'っ', xtsu: 'っ',
  sha: 'しゃ', shi: 'し', shu: 'しゅ', sho: 'しょ',
  sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  cha: 'ちゃ', chi: 'ち', chu: 'ちゅ', cho: 'ちょ',
  tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  tsu: 'つ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
  fya: 'ふゃ', fyu: 'ふゅ', fyo: 'ふょ',
  lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', ji: 'じ',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', tu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', nn: 'ん', "n'": 'ん',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', '-': 'ー'
};

const toHiraganaChar = (str) =>
  str.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const toKatakanaChar = (str) =>
  str.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

function romajiToContextKana(input, flushEnd = false, targetReading = '') {
  const raw = String(input || '');
  const s = raw.toLowerCase();

  const fullTarget = String(targetReading || '').replace(STRIP_PUNCT, '');
  const coreTarget = String(targetReading || '')
    .replace(/[「（(][^」）)]*[」）)]/g, '')
    .replace(STRIP_PUNCT, '');
  const fullHira = toHiraganaChar(fullTarget);
  const coreHira = toHiraganaChar(coreTarget);

  let out = '';
  let i = 0;

  const formatSyllable = (kana, origChunk) => {
    const pos = out.length;
    const prefixHira = toHiraganaChar(out);
    let expectKata = false;

    if (fullTarget && fullHira.startsWith(prefixHira) && KATAKANA_CHAR.test(fullTarget[pos] || '')) {
      expectKata = true;
    } else if (coreTarget && coreHira.startsWith(prefixHira) && KATAKANA_CHAR.test(coreTarget[pos] || '')) {
      expectKata = true;
    } else if (/[A-Z]/.test(origChunk)) {
      expectKata = true;
    }

    return expectKata ? toKatakanaChar(kana) : kana;
  };

  while (i < s.length) {
    const ch = s[i];
    if (!/[a-z'-]/.test(ch)) {
      out += raw[i];
      i++;
      continue;
    }

    if (i + 1 < s.length && ch === s[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(ch)) {
      out += formatSyllable('っ', raw[i]);
      i++;
      continue;
    }

    if (ch === 'n' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "'" || next === 'n') {
        out += formatSyllable('ん', raw.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (!/[aiueoy]/.test(next)) {
        out += formatSyllable('ん', raw[i]);
        i++;
        continue;
      }
    }

    let matched = false;
    for (let len = 4; len >= 1; len--) {
      if (i + len <= s.length) {
        const chunk = s.slice(i, i + len);
        if (ROMAJI_TABLE[chunk]) {
          out += formatSyllable(ROMAJI_TABLE[chunk], raw.slice(i, i + len));
          i += len;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      if (flushEnd && ch === 'n' && i === s.length - 1) {
        out += formatSyllable('ん', raw[i]);
      } else {
        out += raw[i];
      }
      i++;
    }
  }
  return out;
}

function normalizeKana(str) {
  return toHiraganaChar(romajiToContextKana(String(str || '').trim(), true))
    .replace(STRIP_PUNCT, '');
}

function isReadingMatch(userInput, targetReading) {
  const u = normalizeKana(userInput);
  if (!u) return false;
  const full = normalizeKana(targetReading);
  const coreOnly = normalizeKana(String(targetReading || '').replace(/[「（(][^」）)]*[」）)]/g, ''));
  return u === full || (coreOnly.length > 0 && u === coreOnly);
}

function saveWrongWord(word) {
  if (!word?.jp) return;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? [...cur.weakWords] : [];
    if (!list.some((w) => w.jp === word.jp && w.vi === word.vi)) list.push(word);
    return { ...cur, weakWords: list };
  }, { weakWords: [] });
}

function makeTrickyReadings(reading) {
  const r = String(reading || '').trim();
  const traps = new Set();
  if (!r) return [];

  if (r.endsWith('う')) traps.add(r.slice(0, -1));
  else if (/[おうこそとのほもよろ]$/.test(r)) traps.add(`${r}う`);
  if (r.endsWith('い') && r.length > 2) traps.add(r.slice(0, -1));

  for (let i = 0; i < r.length; i++) {
    const swapped = DAKUTEN_MAP[r[i]];
    if (swapped) traps.add(r.slice(0, i) + swapped + r.slice(i + 1));
  }

  if (r.includes('っ')) traps.add(r.replace('っ', ''));
  else if (r.length >= 3) traps.add(r[0] + 'っ' + r.slice(1));

  traps.delete(r);
  return shuffle([...traps]);
}

function createQuestion(word, allWords, isRetry = false) {
  const correctReading = word.reading.trim();
  const distractorSet = new Set();
  const targetKanjis = [...word.jp].filter((c) => HAS_KANJI.test(c));

  const sharedKanjiPeers = allWords.filter(
    (w) => w.reading && w.reading.trim() !== correctReading && [...w.jp].some((c) => targetKanjis.includes(c))
  );
  for (const p of shuffle(sharedKanjiPeers)) {
    if (distractorSet.size < 2) distractorSet.add(p.reading.trim());
  }

  for (const trap of makeTrickyReadings(correctReading)) {
    if (distractorSet.size < 2) distractorSet.add(trap);
  }

  const sameLenPool = allWords.filter(
    (w) => w.reading && w.reading.trim() !== correctReading && Math.abs(w.reading.trim().length - correctReading.length) <= 1
  );
  for (const p of pickN(sameLenPool, 4, word, (w) => w.reading)) {
    if (distractorSet.size < 3 && p.reading.trim() !== correctReading) distractorSet.add(p.reading.trim());
  }

  if (distractorSet.size < 3) {
    for (const o of pickN(allWords.filter((w) => w.reading && w.reading.trim() !== correctReading), 3, word, (w) => w.reading)) {
      if (distractorSet.size < 3) distractorSet.add(o.reading.trim());
    }
  }

  return {
    word,
    correctReading,
    options: shuffle([correctReading, ...[...distractorSet].slice(0, 3)]),
    answered: false,
    correct: false,
    chosenIdx: -1,
    typedVal: '',
    isRetry
  };
}

function formatPromptJP(jp) {
  const escaped = escapeHtml(jp);
  return escaped.replace(
    /^(「[^」]+」)\s*(.+)$/,
    '<span style="font-size:0.72em;color:var(--text-muted);font-weight:600;">$1</span> <span style="display:inline-block;">$2</span>'
  );
}

export function mountKanjiRead(container, allWords = [], onBack) {
  const kanjiWords = allWords.filter((w) => w?.jp && w?.reading && HAS_KANJI.test(w.jp) && w.jp.trim() !== w.reading.trim());

  if (!kanjiWords.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center;display:flex;flex-direction:column;gap:12px;padding:24px 16px;">
        <div class="module-title">Không có từ chứa Kanji</div>
        <p class="module-sub">Bài học này toàn bộ là từ Kana nên không cần luyện đọc Kanji.</p>
        <button type="button" id="kr-empty-back" class="btn btn-teal">← Quay lại</button>
      </div>`;
    container.querySelector('#kr-empty-back').onclick = () => onBack && onBack();
    return;
  }

  let inputMode = 'mcq';
  let queue = shuffle(kanjiWords).map((w) => createQuestion(w, allWords, false));
  let qIdx = 0, firstPassCorrect = 0, soundOn = true, wrongWords = [], finished = false;
  let feedbackAnim = '';
  const wordKey = (w) => `${w.jp}|${w.vi}`;

  const onKeyDown = (e) => {
    if (!document.body.contains(container)) return document.removeEventListener('keydown', onKeyDown);
    if (finished || document.querySelector('dialog[open]')) return;
    const q = queue[qIdx];
    if (!q) return;
    if (!q.answered) {
      if (inputMode === 'mcq' && ['1', '2', '3', '4'].includes(e.key)) {
        container.querySelector(`.kr-opt[data-i="${Number(e.key) - 1}"]`)?.click();
      } else if (inputMode === 'type' && (e.key === '?' || (e.shiftKey && e.key === 'Enter'))) {
        e.preventDefault();
        container.querySelector('#kr-dont-know')?.click();
      }
    } else if (e.key === 'Enter' || (inputMode === 'mcq' && e.key === ' ')) {
      e.preventDefault();
      container.querySelector('#kr-next')?.click();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const exit = () => { document.removeEventListener('keydown', onKeyDown); if (onBack) onBack(); };

  function resetSession(wordsPool) {
    queue = shuffle(wordsPool).map((w) => createQuestion(w, allWords, false));
    qIdx = 0;
    firstPassCorrect = 0;
    wrongWords = [];
    finished = false;
    feedbackAnim = '';
    render();
  }

  function submitAnswer(q, isCorrect, extra = {}) {
    q.answered = true;
    q.correct = isCorrect;
    Object.assign(q, extra);
    feedbackAnim = isCorrect ? 'anim-pop' : 'anim-shake';

    if (isCorrect) {
      if (!q.isRetry) firstPassCorrect++;
    } else {
      saveWrongWord(q.word);
      if (!wrongWords.some((x) => wordKey(x) === wordKey(q.word))) wrongWords.push(q.word);
      const insertAt = Math.min(queue.length, qIdx + 4);
      queue.splice(insertAt, 0, createQuestion(q.word, allWords, true));
    }

    if (soundOn) speakJP(q.correctReading);
    render();
  }

  function render() {
    if (finished) {
      const totalUnique = kanjiWords.length;
      const pct = Math.min(100, Math.round((firstPassCorrect / totalUnique) * 100));
      container.innerHTML = `
        <div class="card anim-pop" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:28px 20px;max-width:520px;margin:0 auto;">
          <div class="module-title" style="font-size:1.5rem;">Hoàn thành Đọc Kanji! 🎉</div>
          <div style="font-size:2.5rem;font-weight:800;color:var(--teal);">${firstPassCorrect} / ${totalUnique} <span style="font-size:1.1rem;color:var(--yellow);">đúng ngay lần đầu (${pct}%)</span></div>
          <p class="module-sub">${wrongWords.length ? `Đã ôn lại trong phiên & lưu ${wrongWords.length} từ từng sai vào Từ cần ôn lại.` : 'Bạn đọc chuẩn ngay từ đầu tất cả chữ Hán!'}</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
            ${wrongWords.length ? `<button type="button" id="kr-retry-wrong" class="btn btn-coral">🔥 Luyện lại ${wrongWords.length} từ từng sai</button>` : ''}
            <button type="button" id="kr-retry-all" class="btn btn-teal">↻ Luyện lại toàn bộ (${totalUnique} từ)</button>
            <button type="button" id="kr-done" class="btn">← Chế độ học</button>
          </div>
        </div>`;
      container.querySelector('#kr-retry-wrong')?.addEventListener('click', () => resetSession([...wrongWords]));
      container.querySelector('#kr-retry-all').onclick = () => resetSession(kanjiWords);
      container.querySelector('#kr-done').onclick = exit;
      return;
    }

    const q = queue[qIdx];
    const pct = Math.max(3, Math.round(((qIdx + 1) / queue.length) * 100));
    const currentAnim = feedbackAnim;
    feedbackAnim = '';

    let answerAreaHtml = '';
    if (inputMode === 'mcq') {
      const optsHtml = q.options.map((opt, i) => {
        const isAns = opt === q.correctReading;
        let bd = 'var(--border)', bg = 'var(--bg-card)', animCls = '';
        if (q.answered) {
          if (isAns) {
            bd = 'var(--green)';
            bg = 'rgba(76,175,106,0.2)';
            if (i === q.chosenIdx) animCls = currentAnim;
          } else if (i === q.chosenIdx) {
            bd = 'var(--red)';
            bg = 'rgba(217,72,59,0.22)';
            animCls = currentAnim;
          }
        }
        return `
          <button type="button" class="card kr-opt ${animCls}" data-i="${i}" ${q.answered ? 'disabled' : ''} style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;border-color:${bd};background:${bg};text-align:left;min-height:60px;">
            <span style="width:32px;height:32px;border-radius:10px;background:${BADGE_COLORS[i]};color:#101320;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
            <span class="jp" style="flex:1;font-weight:700;font-size:1.2rem;color:var(--text);text-align:center;padding-right:16px;">${escapeHtml(opt)}</span>
          </button>`;
      }).join('');
      answerAreaHtml = `<div class="kr-grid">${optsHtml}</div>`;
    } else {
      const bd = q.answered ? (q.correct ? 'var(--green)' : 'var(--red)') : 'var(--teal)';
      const inpAnim = q.answered ? currentAnim : '';
      answerAreaHtml = `
        <div class="card study-card-match" style="padding:18px;">
          <div style="font-size:0.86rem;color:var(--text-muted);font-weight:700;margin-bottom:10px;">Nhập cách đọc (Romaji → Hiragana / Katakana)</div>
          <form id="kr-type-form" style="display:flex;flex-direction:column;gap:12px;">
            <input type="text" id="kr-type-inp" class="jp kr-inp ${inpAnim}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              placeholder="Gõ romaji (vd: warimasu)..."
              value="${escapeHtml(q.typedVal)}" ${q.answered ? 'disabled' : ''}
              style="width:100%;min-height:60px;padding:10px 14px;border-radius:14px;border:2.5px solid ${bd};background:var(--bg-elevated);color:var(--text);font-size:1.45rem;font-weight:700;text-align:center;">
            ${!q.answered ? `
              <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:8px;">
                <button type="submit" class="btn btn-teal" style="font-size:1rem;">Kiểm tra <span class="kbd-hint">Enter ↵</span></button>
                <button type="button" id="kr-dont-know" class="btn" style="font-size:0.95rem;">Không nhớ <span class="kbd-hint">Shift ↵</span></button>
              </div>` : ''}
          </form>
        </div>`;
    }

    const explainHtml = q.answered ? `
      <div class="card ${currentAnim}" style="margin-top:14px;border-color:${q.correct ? 'var(--green)' : 'var(--red)'};display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-weight:800;color:${q.correct ? 'var(--green)' : 'var(--red)'};font-size:1.02rem;">
            ${q.correct ? '✓ Đọc chính xác!' : '✕ Sai rồi — sẽ hỏi lại sau vài câu nữa'}
          </span>
          <button type="button" id="kr-speak" class="btn" style="padding:4px 12px;font-size:0.9rem;">🔊 Nghe</button>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
          <span class="jp" style="font-size:1.5rem;font-weight:700;">${escapeHtml(q.word.jp)}</span>
          <span class="jp" style="color:var(--teal);font-weight:700;font-size:1.15rem;">【${escapeHtml(q.correctReading)}】</span>
          <span style="color:var(--yellow);font-weight:800;font-size:1.1rem;">— ${escapeHtml(q.word.vi)}</span>
        </div>
        ${q.word.ex ? `<div style="padding-top:8px;border-top:1.5px dashed var(--border);"><div class="jp" style="font-size:0.98rem;line-height:1.7;">${parseRuby(q.word.ex)}</div>${q.word.exVi ? `<div style="font-size:0.88rem;color:var(--text-muted);">${escapeHtml(q.word.exVi)}</div>` : ''}</div>` : ''}
        <button type="button" id="kr-next" class="btn btn-yellow" style="width:100%;margin-top:4px;">${qIdx < queue.length - 1 ? 'Câu tiếp theo →' : 'Xem kết quả 🏁'} <span class="kbd-hint">Enter ↵</span></button>
      </div>` : '';

    container.innerHTML = `
      <style>.kr-grid{display:grid;grid-template-columns:1fr;gap:10px;}@media(min-width:420px){.kr-grid{grid-template-columns:1fr 1fr;}}</style>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="font-size:1.12rem;font-weight:800;">ĐỌC KANJI</span>
            <span style="padding:2px 10px;border-radius:999px;background:#F5C84F;color:#101320;font-weight:800;font-size:0.82rem;">Câu ${qIdx + 1}/${queue.length}</span>
            ${q.isRetry ? `<span style="padding:2px 8px;border-radius:999px;background:rgba(240,143,122,0.22);color:var(--coral);border:1px solid var(--coral);font-weight:800;font-size:0.75rem;">Ôn lại</span>` : ''}
          </div>
          <div style="width:100%;height:10px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:999px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:var(--yellow);border-radius:999px;transition:width 0.25s ease;"></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <button type="button" class="btn kr-mode-sw ${inputMode === 'mcq' ? 'btn-teal' : ''}" data-m="mcq" style="min-height:40px;padding:4px 12px;font-size:0.85rem;">🔘 Trắc nghiệm</button>
          <button type="button" class="btn kr-mode-sw ${inputMode === 'type' ? 'btn-teal' : ''}" data-m="type" style="min-height:40px;padding:4px 12px;font-size:0.85rem;">⌨️ Tự gõ Kana</button>
          <button type="button" id="kr-mute" class="btn btn-icon btn-yellow" title="Bật/Tắt tiếng">${soundOn ? '🔊' : '🔇'}</button>
          <button type="button" id="kr-quit" class="btn btn-icon" style="background:var(--red);color:#fff;border-color:#101320;" title="Thoát">⏻</button>
        </div>
      </div>

      <div class="study-split">
        <div class="study-left">
          <div class="card study-card-match" style="padding:18px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
              <span style="padding:3px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;border:1.5px solid var(--yellow);color:var(--yellow);background:rgba(245,200,79,0.12);">${inputMode === 'mcq' ? 'Nhận diện' : 'Tự nhớ chủ động'}</span>
              <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${inputMode === 'mcq' ? 'Chọn cách đọc đúng' : 'Gõ cách đọc của từ này'}</span>
            </div>
            <div class="jp" style="background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:16px;padding:38px 16px;text-align:center;font-size:clamp(1.65rem,3.4vw,2.5rem);font-weight:700;word-break:keep-all;overflow-wrap:break-word;">${formatPromptJP(q.word.jp)}</div>
          </div>
        </div>

        <div class="study-right">
          ${answerAreaHtml}
          ${explainHtml}
        </div>
      </div>
    `;

    container.querySelector('#kr-mute').onclick = () => { soundOn = !soundOn; render(); };
    container.querySelector('#kr-quit').onclick = exit;
    container.querySelectorAll('.kr-mode-sw').forEach((b) => {
      b.onclick = () => {
        if (inputMode !== b.dataset.m) {
          inputMode = b.dataset.m;
          render();
        }
      };
    });

    container.querySelector('#kr-speak')?.addEventListener('click', () => speakJP(q.correctReading));
    container.querySelector('#kr-next')?.addEventListener('click', () => {
      if (qIdx < queue.length - 1) { qIdx++; render(); }
      else { finished = true; render(); }
    });

    if (inputMode === 'mcq') {
      container.querySelectorAll('.kr-opt').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.i);
          submitAnswer(q, q.options[idx] === q.correctReading, { chosenIdx: idx });
        };
      });
    } else {
      const inp = container.querySelector('#kr-type-inp');
      if (inp && !q.answered) {
        inp.focus();
        inp.onkeydown = (e) => {
          if (e.key === '?' || (e.shiftKey && e.key === 'Enter')) {
            e.preventDefault();
            e.stopPropagation();
            container.querySelector('#kr-dont-know')?.click();
          }
        };
        inp.oninput = () => {
          const converted = romajiToContextKana(inp.value, false, q.correctReading);
          if (converted !== inp.value) {
            inp.value = converted;
          }
          q.typedVal = inp.value;
        };
      }
      container.querySelector('#kr-type-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (q.answered) return;
        const displayKana = romajiToContextKana(inp?.value || '', true, q.correctReading).replace(STRIP_PUNCT, '');
        if (!displayKana) return;
        submitAnswer(q, isReadingMatch(inp?.value || '', q.correctReading), { typedVal: displayKana });
      });
      container.querySelector('#kr-dont-know')?.addEventListener('click', () => {
        if (!q.answered) submitAnswer(q, false, { typedVal: '(Bỏ qua)' });
      });
    }
  }

  render();
}