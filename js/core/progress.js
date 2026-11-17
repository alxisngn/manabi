import { getStore, updateStore } from './store.js';

export const PASS_RATE = 1.0;
const STORE_KEY = 'progress';
let migrated = false;

function normalizeLessonId(level, skill, lessonId) {
  const lv = String(level || 'N4').toLowerCase();
  const sk = String(skill || 'vocab').toLowerCase();
  const raw = String(lessonId || '');
  if (sk === 'vocab' && lv === 'n4') return raw;
  const m = raw.match(/^b(\d+)$/i);
  return m ? `${lv}-${sk}-b${m[1]}` : raw;
}

const makeKey = (level, skill, lessonId) =>
  `${String(level || 'N4').toLowerCase()}/${String(skill || 'vocab').toLowerCase()}/${normalizeLessonId(level, skill, lessonId)}`;

function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  const st = getStore(STORE_KEY, { lessons: {} });
  const oldLessons = st?.lessons;
  if (!oldLessons || typeof oldLessons !== 'object') return;

  let changed = false;
  const nextLessons = { ...oldLessons };
  for (const [k, val] of Object.entries(oldLessons)) {
    const m = k.match(/^(n[1-5])\/(kanji)\/b(\d+)$/i);
    if (!m) continue;
    const lv = m[1].toLowerCase();
    const sk = m[2].toLowerCase();
    const newKey = `${lv}/${sk}/${lv}-${sk}-b${m[3]}`;
    if (!nextLessons[newKey]) {
      nextLessons[newKey] = { ...val };
    }
    delete nextLessons[k];
    changed = true;
  }

  if (changed) {
    updateStore(STORE_KEY, (cur) => ({ ...cur, lessons: nextLessons }), { lessons: {} });
  }
}

export function getLessonProgress(level, skill, lessonId) {
  ensureMigrated();
  const st = getStore(STORE_KEY, { lessons: {} });
  return st?.lessons?.[makeKey(level, skill, lessonId)] || null;
}

export function getLastStudiedSkill(level) {
  ensureMigrated();
  const prefix = `${String(level || 'N4').toLowerCase()}/`;
  const st = getStore(STORE_KEY, { lessons: {} });
  const entries = Object.entries(st?.lessons || {}).filter(([k]) => k.startsWith(prefix));
  if (!entries.length) return 'vocab';
  entries.sort((a, b) => String(b[1]?.updatedAt || b[1]?.lastAt || '').localeCompare(String(a[1]?.updatedAt || a[1]?.lastAt || '')));
  const parts = entries[0][0].split('/');
  return parts[1] || 'vocab';
}

export function markStudied(level, skill, lessonId) {
  ensureMigrated();
  if (!lessonId || String(lessonId).startsWith('user:')) return null;
  const key = makeKey(level, skill, lessonId);
  const now = new Date().toISOString();
  let result = null;
  updateStore(STORE_KEY, (cur) => {
    const lessons = { ...(cur?.lessons || {}) };
    const prev = lessons[key];
    if (prev?.status === 'done') {
      result = { ...prev, lastAt: now, updatedAt: now };
      lessons[key] = result;
      return { ...cur, lessons };
    }
    result = {
      status: 'learning',
      attempts: prev?.attempts || 0,
      bestPct: prev?.bestPct ?? null,
      lastPct: prev?.lastPct ?? null,
      firstDoneAt: prev?.firstDoneAt || null,
      lastAt: now,
      updatedAt: now
    };
    lessons[key] = result;
    return { ...cur, lessons };
  }, { lessons: {} });
  return result;
}

export function recordTest(level, skill, lessonId, pct) {
  ensureMigrated();
  if (!lessonId) return null;
  const key = makeKey(level, skill, lessonId);
  const now = new Date().toISOString();
  const scorePct = Math.max(0, Math.min(100, Number(pct) || 0));
  const passed = scorePct >= PASS_RATE * 100;
  let result = null;

  updateStore(STORE_KEY, (cur) => {
    const lessons = { ...(cur?.lessons || {}) };
    const prev = lessons[key] || {};
    const wasDone = prev.status === 'done';
    const isDone = wasDone || passed;
    result = {
      status: isDone ? 'done' : 'learning',
      attempts: (Number(prev.attempts) || 0) + 1,
      bestPct: prev.bestPct != null ? Math.max(Number(prev.bestPct), scorePct) : scorePct,
      lastPct: scorePct,
      firstDoneAt: prev.firstDoneAt || (passed ? now : null),
      lastAt: now,
      updatedAt: now
    };
    lessons[key] = result;
    return { ...cur, lessons };
  }, { lessons: {} });

  return result;
}

export function getSummary(level, skill, lessonList = []) {
  ensureMigrated();
  const st = getStore(STORE_KEY, { lessons: {} });
  const map = st?.lessons || {};
  let done = 0;
  let learning = 0;

  const items = lessonList.map((l) => {
    const lessonId = String(l.id ?? l.lessonId ?? '');
    const rec = map[makeKey(level, skill, lessonId)];
    const status = rec?.status === 'done' ? 'done' : rec?.status === 'learning' ? 'learning' : 'none';
    if (status === 'done') done++;
    else if (status === 'learning') learning++;
    return {
      lessonId,
      name: l.name || lessonId,
      status,
      bestPct: rec?.bestPct ?? null,
      attempts: Number(rec?.attempts) || 0,
      lastAt: rec?.lastAt || null
    };
  });

  return { total: items.length, done, learning, items };
}