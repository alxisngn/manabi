import { fetchWords } from './data.js';

const allWordsCache = {};

export const smUiState = {
  week: null,
  addingDay: null,
  query: '',
  extraDraft: '',
  jsonMode: false,
  jsonDraft: '',
  candidates: [],
  selectedWords: [],
  errMsg: ''
};

export const getSomatomeWeeks = (skill) => (skill === 'kanji' ? [1, 2, 3] : [4, 5, 6]);

export const parseSomatomeTag = (name) => {
  const m = String(name || '').match(/Tuần\s*([1-6])\s*[-–—]\s*Ngày\s*([1-6])/i);
  return m ? { week: Number(m[1]), day: Number(m[2]) } : null;
};

export async function loadAllSkillWords(lessons, level, skill) {
  const key = `${level}:${skill}`;
  if (allWordsCache[key]) return allWordsCache[key];
  const repoItems = lessons.filter((l) => l.source === 'repo');
  const buckets = await Promise.all(repoItems.map((l) => fetchWords(l, level, skill)));
  const flat = buckets.flat();
  allWordsCache[key] = flat;
  return flat;
}

export function parseQuickWordInput(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return null;

  if (clean.includes('|')) {
    const parts = clean.split('|').map((s) => s.trim());
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      return { jp: parts[0], reading: parts[1], vi: parts.slice(2).join(' '), pos: 'noun' };
    }
    return null;
  }

  const tokens = clean.split(/[\s\u3000]+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const jp = tokens[0];
  const isPureKana = /^[\u3040-\u30FFー・〜]+$/.test(jp);

  if (tokens.length === 2 && isPureKana) {
    return { jp, reading: jp, vi: tokens[1], pos: 'noun' };
  }
  if (tokens.length >= 3) {
    return { jp, reading: tokens[1], vi: tokens.slice(2).join(' '), pos: 'noun' };
  }
  return null;
}

export function parseJsonBatch(raw) {
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.words) ? parsed.words : []);
    return arr
      .filter((w) => w && (w.jp || w.word) && (w.vi || w.meaning))
      .map((w) => {
        const jp = String(w.jp || w.word).trim();
        return {
          jp,
          reading: String(w.reading || w.kana || jp).trim(),
          vi: String(w.vi || w.meaning).trim(),
          pos: String(w.pos || 'noun').trim(),
          ...(w.ex ? { ex: String(w.ex).trim() } : {}),
          ...(w.exVi ? { exVi: String(w.exVi).trim() } : {})
        };
      });
  } catch {
    return null;
  }
}

export function resetAddDraft() {
  smUiState.addingDay = null;
  smUiState.query = '';
  smUiState.extraDraft = '';
  smUiState.jsonMode = false;
  smUiState.jsonDraft = '';
  smUiState.candidates = [];
  smUiState.selectedWords = [];
  smUiState.errMsg = '';
}

export const isPicked = (jp) => smUiState.selectedWords.some((w) => w.jp === jp);

export function toggleWordSelection(word) {
  const idx = smUiState.selectedWords.findIndex((w) => w.jp === word.jp);
  if (idx >= 0) smUiState.selectedWords.splice(idx, 1);
  else smUiState.selectedWords.push({ ...word });
}