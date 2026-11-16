const PREFIX = 'manabi:';
const META_KEY = 'manabi:_meta';
const NAV_COLLAPSED_KEY = 'manabi:navCollapsed';
const EXCLUDED_BACKUP_SUFFIXES = new Set(['syncKey', 'app', 'navCollapsed', '_meta', 'syncRev']);

export function getStore(moduleName, fallback = {}) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${moduleName}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Lỗi đọc store ${moduleName}:`, err);
    return fallback;
  }
}

export function setStore(moduleName, data) {
  try {
    localStorage.setItem(`${PREFIX}${moduleName}`, JSON.stringify(data));
    if (moduleName !== '_meta') {
      const now = new Date().toISOString();
      let meta = {};
      try {
        meta = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
      } catch {
        meta = {};
      }
      meta[moduleName] = now;
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('manabi:changed', { detail: { key: moduleName } }));
      }
    }
    return true;
  } catch (err) {
    console.error(`Lỗi ghi store ${moduleName}:`, err);
    return false;
  }
}

export function updateStore(moduleName, updater, fallback = {}) {
  const current = getStore(moduleName, fallback);
  const next = updater(current);
  setStore(moduleName, next);
  return next;
}

export function getNavCollapsed() {
  try {
    return localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setNavCollapsed(collapsed) {
  try {
    localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

function isBackupAllowedKey(fullKey) {
  if (!fullKey || !fullKey.startsWith(PREFIX)) return false;
  const suffix = fullKey.slice(PREFIX.length);
  return !EXCLUDED_BACKUP_SUFFIXES.has(suffix);
}

export function exportBackup() {
  const payload = {
    app: 'manabi',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isBackupAllowedKey(key)) {
      try {
        payload.data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        payload.data[key] = localStorage.getItem(key);
      }
    }
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `manabi-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || parsed.app !== 'manabi' || typeof parsed.data !== 'object') {
          throw new Error('Định dạng file backup Manabi không hợp lệ.');
        }
        Object.entries(parsed.data).forEach(([key, val]) => {
          if (isBackupAllowedKey(key)) {
            const moduleName = key.slice(PREFIX.length);
            setStore(moduleName, val);
          }
        });
        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file này.'));
    reader.readAsText(file);
  });
}