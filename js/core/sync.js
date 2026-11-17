const SYNC_KEY_STORAGE = 'manabi:syncKey';
const SYNC_REV_STORAGE = 'manabi:syncRev';
const META_STORAGE = 'manabi:_meta';
const PREFIX = 'manabi:';
const SYNC_KEYS = ['vocab', 'kanji', 'progress'];
const KEY_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const FETCH_TIMEOUT_MS = 8000;
const DEBOUNCE_MS = 3000;
const VISIBLE_MIN_GAP_MS = 30000;

let status = {
  state: getStoredKey() ? 'idle' : 'off',
  lastSyncAt: null
};
let activePromise = null;
let debounceTimer = null;
let lastAttemptAt = 0;
let initialized = false;
const listeners = new Set();

function getStoredKey() {
  try {
    return localStorage.getItem(SYNC_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function getStoredRev() {
  try {
    const n = Number(localStorage.getItem(SYNC_REV_STORAGE));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function setStoredRev(rev) {
  try {
    localStorage.setItem(SYNC_REV_STORAGE, String(Number(rev) || 0));
  } catch {}
}

function emitStatus(next) {
  status = { ...status, ...next };
  const snapshot = getSyncStatus();
  listeners.forEach((cb) => {
    try { cb(snapshot); } catch {}
  });
}

export function getSyncStatus() {
  return { ...status };
}

export function onSyncStatus(cb) {
  if (typeof cb !== 'function') return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSyncKey() {
  return getStoredKey();
}

export function createSyncKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let key = '';
  for (let i = 0; i < bytes.length; i++) {
    key += CHARSET[bytes[i] % CHARSET.length];
  }
  return setSyncKey(key);
}

export function setSyncKey(k) {
  const trimmed = String(k || '').trim();
  if (!KEY_PATTERN.test(trimmed)) {
    throw new Error('Mã đồng bộ phải dài 24–128 ký tự và chỉ gồm chữ, số, "_" hoặc "-".');
  }
  localStorage.setItem(SYNC_KEY_STORAGE, trimmed);
  localStorage.removeItem(SYNC_REV_STORAGE);
  emitStatus({ state: 'idle', lastSyncAt: null });
  syncNow();
  return trimmed;
}

export function clearSyncKey() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  localStorage.removeItem(SYNC_KEY_STORAGE);
  localStorage.removeItem(SYNC_REV_STORAGE);
  emitStatus({ state: 'off', lastSyncAt: null });
}

function normalizeAlbum(cl, fallbackTime, idx) {
  const id = cl?.id ? String(cl.id) : `album-${fallbackTime}-${idx}`;
  const updatedAt = cl?.updatedAt || cl?.deletedAt || fallbackTime;
  return { ...cl, id, updatedAt };
}

function readLocalPayload() {
  let meta = {};
  try {
    meta = JSON.parse(localStorage.getItem(META_STORAGE) || '{}') || {};
  } catch {
    meta = {};
  }
  const keys = {};
  for (const k of SYNC_KEYS) {
    const raw = localStorage.getItem(`${PREFIX}${k}`);
    if (raw !== null) {
      try {
        keys[k] = {
          value: JSON.parse(raw),
          updatedAt: typeof meta[k] === 'string' ? meta[k] : ''
        };
      } catch {}
    }
  }
  return { keys };
}

function writeLocalPayload(mergedKeys) {
  let meta = {};
  try {
    meta = JSON.parse(localStorage.getItem(META_STORAGE) || '{}') || {};
  } catch {
    meta = {};
  }
  for (const k of SYNC_KEYS) {
    const entry = mergedKeys[k];
    if (!entry || entry.value === undefined) continue;
    localStorage.setItem(`${PREFIX}${k}`, JSON.stringify(entry.value));
    if (entry.updatedAt) meta[k] = entry.updatedAt;
  }
  localStorage.setItem(META_STORAGE, JSON.stringify(meta));
}

function mergeProgressValues(localVal, remoteVal) {
  const lLessons = localVal?.lessons && typeof localVal.lessons === 'object' ? localVal.lessons : {};
  const rLessons = remoteVal?.lessons && typeof remoteVal.lessons === 'object' ? remoteVal.lessons : {};
  const allIds = new Set([...Object.keys(lLessons), ...Object.keys(rLessons)]);
  const lessons = {};

  for (const id of allIds) {
    const l = lLessons[id];
    const r = rLessons[id];
    if (!l) { lessons[id] = { ...r }; continue; }
    if (!r) { lessons[id] = { ...l }; continue; }

    const lTime = String(l.updatedAt || l.lastAt || '');
    const rTime = String(r.updatedAt || r.lastAt || '');
    const winner = rTime > lTime ? { ...r } : { ...l };

    if (l.status === 'done' || r.status === 'done') {
      winner.status = 'done';
      const firstDates = [l.firstDoneAt, r.firstDoneAt].filter(Boolean).sort();
      winner.firstDoneAt = firstDates[0] || winner.firstDoneAt || null;
    }
    if (l.bestPct != null || r.bestPct != null) {
      winner.bestPct = Math.max(Number(l.bestPct) || 0, Number(r.bestPct) || 0);
    }
    winner.attempts = Math.max(Number(l.attempts) || 0, Number(r.attempts) || 0);
    lessons[id] = winner;
  }

  return { ...(rLessons ? remoteVal : {}), ...(localVal || {}), lessons };
}

function mergeKanjiValues(localEntry, remoteEntry, nowIso) {
  const lVal = localEntry?.value || {};
  const rVal = remoteEntry?.value || {};
  const lTime = String(localEntry?.updatedAt || '');
  const rTime = String(remoteEntry?.updatedAt || '');
  const base = rTime > lTime ? { ...rVal } : { ...lVal };

  const lList = Array.isArray(lVal.customLessons) ? lVal.customLessons : [];
  const rList = Array.isArray(rVal.customLessons) ? rVal.customLessons : [];
  const map = new Map();

  lList.forEach((cl, i) => {
    if (!cl || typeof cl !== 'object') return;
    const norm = normalizeAlbum(cl, lTime || nowIso, i);
    map.set(norm.id, norm);
  });

  rList.forEach((cl, i) => {
    if (!cl || typeof cl !== 'object') return;
    const norm = normalizeAlbum(cl, rTime || nowIso, i);
    const existing = map.get(norm.id);
    if (!existing) {
      map.set(norm.id, norm);
    } else {
      const exTime = String(existing.deletedAt || existing.updatedAt || '');
      const rmTime = String(norm.deletedAt || norm.updatedAt || '');
      if (rmTime > exTime) map.set(norm.id, norm);
    }
  });

  base.customLessons = [...map.values()];
  return base;
}

function mergeData(localData, remoteData) {
  const lKeys = localData?.keys || {};
  const rKeys = remoteData?.keys || {};
  const mergedKeys = {};
  const nowIso = new Date().toISOString();

  for (const k of SYNC_KEYS) {
    const l = lKeys[k];
    const r = rKeys[k];
    if (!l && !r) continue;
    if (!l) {
      const val = k === 'kanji' ? mergeKanjiValues(null, r, nowIso) : r.value;
      mergedKeys[k] = { value: val, updatedAt: r.updatedAt || nowIso };
      continue;
    }
    if (!r) {
      const val = k === 'kanji' ? mergeKanjiValues(l, null, nowIso) : l.value;
      mergedKeys[k] = { value: val, updatedAt: l.updatedAt || nowIso };
      continue;
    }

    if (k === 'progress') {
      const latest = [l.updatedAt, r.updatedAt].filter(Boolean).sort().pop() || nowIso;
      mergedKeys[k] = {
        value: mergeProgressValues(l.value, r.value),
        updatedAt: latest
      };
    } else if (k === 'kanji') {
      const latest = [l.updatedAt, r.updatedAt].filter(Boolean).sort().pop() || nowIso;
      mergedKeys[k] = {
        value: mergeKanjiValues(l, r, nowIso),
        updatedAt: latest
      };
    } else {
      const lTime = String(l.updatedAt || '');
      const rTime = String(r.updatedAt || '');
      const win = rTime > lTime ? r : l;
      mergedKeys[k] = { value: win.value, updatedAt: win.updatedAt || nowIso };
    }
  }

  return { keys: mergedKeys };
}

function normalizeSnapshot(data) {
  const out = {};
  for (const k of SYNC_KEYS) {
    const item = data?.keys?.[k];
    if (item && item.value !== undefined) {
      out[k] = { value: item.value, updatedAt: item.updatedAt || '' };
    }
  }
  return JSON.stringify(out);
}

async function apiFetch(method, syncKey, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const init = {
      method,
      headers: { 'X-Sync-Key': syncKey },
      signal: ctrl.signal
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return await fetch('/api/sync', init);
  } finally {
    clearTimeout(timer);
  }
}

export async function syncNow() {
  const syncKey = getStoredKey();
  if (!syncKey) {
    emitStatus({ state: 'off', lastSyncAt: null });
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emitStatus({ state: 'offline' });
    return false;
  }
  if (activePromise) return activePromise;

  activePromise = (async () => {
    lastAttemptAt = Date.now();
    emitStatus({ state: 'syncing' });
    try {
      const getRes = await apiFetch('GET', syncKey);
      if (!getRes.ok) {
        emitStatus({ state: 'error' });
        return false;
      }
      const remote = await getRes.json();
      let serverData = remote?.found && remote?.data ? remote.data : { keys: {} };
      let baseRev = Number(remote?.rev) || 0;

      for (let attempt = 0; attempt < 3; attempt++) {
        const localData = readLocalPayload();
        const merged = mergeData(localData, serverData);
        writeLocalPayload(merged.keys);

        const hasMergedKeys = Object.keys(merged.keys).length > 0;
        const isSameAsServer = remote?.found && normalizeSnapshot(merged) === normalizeSnapshot(serverData);

        if (!hasMergedKeys || isSameAsServer) {
          setStoredRev(baseRev);
          emitStatus({ state: 'ok', lastSyncAt: new Date().toISOString() });
          return true;
        }

        const putRes = await apiFetch('PUT', syncKey, { data: merged, baseRev });
        if (putRes.ok) {
          const putJson = await putRes.json();
          const newRev = Number(putJson?.rev) || baseRev + 1;
          setStoredRev(newRev);
          emitStatus({ state: 'ok', lastSyncAt: new Date().toISOString() });
          return true;
        }
        if (putRes.status === 409) {
          const conflictJson = await putRes.json();
          serverData = conflictJson?.data || { keys: {} };
          baseRev = Number(conflictJson?.rev) || baseRev;
          continue;
        }

        emitStatus({ state: 'error' });
        return false;
      }

      emitStatus({ state: 'error' });
      return false;
    } catch {
      emitStatus({ state: 'offline' });
      return false;
    } finally {
      activePromise = null;
    }
  })();

  return activePromise;
}

function scheduleDebouncedSync() {
  if (!getStoredKey()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncNow();
  }, DEBOUNCE_MS);
}

export function initSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => {
    if (getStoredKey()) syncNow();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getStoredKey()) {
      if (Date.now() - lastAttemptAt >= VISIBLE_MIN_GAP_MS) {
        syncNow();
      }
    }
  });

  window.addEventListener('manabi:changed', (e) => {
    const changedKey = e?.detail?.key;
    if (SYNC_KEYS.includes(changedKey) && getStoredKey()) {
      scheduleDebouncedSync();
    }
  });

  if (getStoredKey()) {
    syncNow();
  }
}

initSync();