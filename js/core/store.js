const PREFIX = 'manabi:';

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

export function exportBackup() {
  const payload = {
    app: 'manabi',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
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
          if (key.startsWith(PREFIX)) {
            localStorage.setItem(key, JSON.stringify(val));
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