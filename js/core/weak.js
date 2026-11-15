import { getStore, updateStore } from './store.js';

const STORE_KEY = 'vocab';
const DEFAULT_DATA = { weakWords: [] };

export const isSameWord = (a, b) => Boolean(a && b && a.jp === b.jp && a.vi === b.vi);

export function getWeak() {
  const list = getStore(STORE_KEY, DEFAULT_DATA).weakWords;
  return Array.isArray(list) ? [...list] : [];
}

export function isWeak(word) {
  if (!word?.jp) return false;
  return getWeak().some((w) => isSameWord(w, word));
}

export function addWeak(word) {
  if (!word?.jp) return false;
  let added = false;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? [...cur.weakWords] : [];
    if (!list.some((w) => isSameWord(w, word))) {
      list.push(word);
      added = true;
    }
    return { ...cur, weakWords: list };
  }, DEFAULT_DATA);
  return added;
}

export function removeWeak(word) {
  if (!word?.jp) return false;
  let removed = false;
  updateStore(STORE_KEY, (cur) => {
    const list = Array.isArray(cur.weakWords) ? cur.weakWords : [];
    const next = list.filter((w) => !isSameWord(w, word));
    if (next.length < list.length) removed = true;
    return { ...cur, weakWords: next };
  }, DEFAULT_DATA);
  return removed;
}

export function clearWeak() {
  updateStore(STORE_KEY, (cur) => ({ ...cur, weakWords: [] }), DEFAULT_DATA);
}