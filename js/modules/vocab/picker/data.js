import { shuffle } from '../../../core/util.js';
import { getWeak } from '../../../core/weak.js';

export const STORE_KEY = 'vocab';
export const getStoreKey = (skill = 'vocab') => (skill === 'kanji' ? 'kanji' : 'vocab');
export const DEFAULT_STORE = { selectedIds: [], customLessons: [], openWords: [], weakWords: [] };

const repoCache = {};

export async function fetchRepo(level, skill = 'vocab') {
  const key = `${level.toLowerCase()}:${skill}`;
  if (repoCache[key]) return repoCache[key];
  try {
    const res = await fetch(`data/${level.toLowerCase()}/${skill}/index.json`);
    repoCache[key] = res.ok ? ((await res.json())?.lessons || []) : [];
  } catch { repoCache[key] = []; }
  return repoCache[key];
}

export const cleanName = (n) => String(n || '').replace(/\s*\(N[1-5]\)\s*/gi, '').trim();

export function buildLessons(repo, st, activeLevel) {
  const list = [];
  const weakWords = getWeak();
  if (weakWords.length) list.push({ id: 'user:weak', name: '📌 Từ cần ôn lại', count: weakWords.length, words: weakWords, source: 'local' });
  if (st.openWords?.length) list.push({ id: 'user:open', name: '📖 Từ mở rộng', count: st.openWords.length, words: st.openWords, source: 'local' });
  (st.customLessons || []).forEach((cl) => {
    if (cl && !cl.deletedAt && cl.id && cl.words?.length) {
      list.push({ id: String(cl.id), name: cleanName(cl.name || 'Bài tự thêm'), count: cl.words.length, words: cl.words, source: 'local' });
    }
  });
  repo.forEach((l) => list.push({ id: l.id, level: activeLevel, name: cleanName(l.name), file: l.file, count: Number(l.count) || 0, source: 'repo' }));
  return list;
}

export async function fetchWords(item, level, skill = 'vocab') {
  if (item.source === 'local') return [...(item.words || [])];
  try {
    const res = await fetch(`data/${level.toLowerCase()}/${skill}/${item.file}`);
    return res.ok ? ((await res.json())?.words || []) : [];
  } catch { return []; }
}

export function sampleBalanced(buckets, limit) {
  const groups = buckets.map((b) => shuffle(b)).filter((g) => g.length);
  const total = groups.reduce((s, g) => s + g.length, 0);
  if (!limit || limit >= total) return shuffle(groups.flat());
  const out = [];
  while (out.length < limit && groups.some((g) => g.length)) {
    for (const g of groups) if (g.length && out.length < limit) out.push(g.pop());
  }
  return shuffle(out);
}