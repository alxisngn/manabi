import { escapeHtml } from './util.js';

const RUBY_REGEX = /([一-龯々〆ヵヶ]+)\[([^\]]+)\]/g;

export function parseRuby(text = '') {
  if (!text) return '';
  let result = '';
  let lastIndex = 0;
  const str = String(text);

  for (const match of str.matchAll(RUBY_REGEX)) {
    const [full, kanji, reading] = match;
    const index = match.index;
    if (index > lastIndex) {
      result += escapeHtml(str.slice(lastIndex, index));
    }
    result += `<ruby>${escapeHtml(kanji)}<rt>${escapeHtml(reading)}</rt></ruby>`;
    lastIndex = index + full.length;
  }

  if (lastIndex < str.length) {
    result += escapeHtml(str.slice(lastIndex));
  }

  return result;
}

export function stripRuby(text = '') {
  return String(text).replace(RUBY_REGEX, '$1');
}