import { getStore, updateStore } from '../../core/store.js';

const STORE_KEY = 'grammar';
const DEFAULT_DATA = { lessons: {} };

export function getGrammarState(lessonId) {
  const data = getStore(STORE_KEY, DEFAULT_DATA) || DEFAULT_DATA;
  return data.lessons?.[lessonId] || null;
}

export function saveGrammarState(lessonId, payload) {
  if (!lessonId) return;
  updateStore(STORE_KEY, (cur) => {
    const lessons = { ...(cur?.lessons || {}) };
    lessons[lessonId] = { ...payload, updatedAt: new Date().toISOString() };
    return { ...cur, lessons };
  }, DEFAULT_DATA);
}

export function clearGrammarState(lessonId) {
  if (!lessonId) return;
  updateStore(STORE_KEY, (cur) => {
    const lessons = { ...(cur?.lessons || {}) };
    delete lessons[lessonId];
    return { ...cur, lessons };
  }, DEFAULT_DATA);
}