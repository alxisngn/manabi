export const KATAKANA_CHAR = /[\u30A1-\u30F6]/;
export const STRIP_PUNCT = /[^\p{L}\p{N}ー]+/gu;

export const ROMAJI_TABLE = {
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

export const toHiraganaChar = (str) =>
  str.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export const toKatakanaChar = (str) =>
  str.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

export function formatSyllable(kana, origChunk, out = '', ctx = {}) {
  const { fullTarget = '', coreTarget = '', fullHira = '', coreHira = '' } = ctx;
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
}

export function romajiToContextKana(input, flushEnd = false, targetReading = '') {
  const raw = String(input || '');
  const s = raw.toLowerCase();

  const fullTarget = String(targetReading || '').replace(STRIP_PUNCT, '');
  const coreTarget = String(targetReading || '')
    .replace(/[「（(][^」）)]*[」）)]/g, '')
    .replace(STRIP_PUNCT, '');
  const ctx = {
    fullTarget,
    coreTarget,
    fullHira: toHiraganaChar(fullTarget),
    coreHira: toHiraganaChar(coreTarget)
  };

  let out = '';
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (!/[a-z'-]/.test(ch)) {
      out += raw[i];
      i++;
      continue;
    }

    if (i + 1 < s.length && ch === s[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(ch)) {
      out += formatSyllable('っ', raw[i], out, ctx);
      i++;
      continue;
    }

    if (ch === 'n' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "'" || next === 'n') {
        out += formatSyllable('ん', raw.slice(i, i + 2), out, ctx);
        i += 2;
        continue;
      }
      if (!/[aiueoy]/.test(next)) {
        out += formatSyllable('ん', raw[i], out, ctx);
        i++;
        continue;
      }
    }

    let matched = false;
    for (let len = 4; len >= 1; len--) {
      if (i + len <= s.length) {
        const chunk = s.slice(i, i + len);
        if (ROMAJI_TABLE[chunk]) {
          out += formatSyllable(ROMAJI_TABLE[chunk], raw.slice(i, i + len), out, ctx);
          i += len;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      if (flushEnd && ch === 'n' && i === s.length - 1) {
        out += formatSyllable('ん', raw[i], out, ctx);
      } else {
        out += raw[i];
      }
      i++;
    }
  }
  return out;
}

export function normalizeKana(str) {
  return toHiraganaChar(romajiToContextKana(String(str || '').trim(), true))
    .replace(STRIP_PUNCT, '');
}

export function isKanaMatch(userInput, target, { includeJp = false } = {}) {
  const u = normalizeKana(userInput);
  if (!u) return false;
  const targets = typeof target === 'string'
    ? [target].filter(Boolean)
    : (includeJp ? [target?.reading, target?.jp] : [target?.reading]).filter(Boolean);
  for (const t of targets) {
    const full = normalizeKana(t);
    const coreOnly = normalizeKana(String(t).replace(/[「（(][^」）)]*[」）)]/g, ''));
    if (u === full || (coreOnly.length > 0 && u === coreOnly)) return true;
  }
  return false;
}