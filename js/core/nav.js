import { getStore, updateStore } from './store.js';

const APP_KEY = 'app';
const DEFAULT_APP = { level: 'N4' };

export function hasLevel() {
  const st = getStore(APP_KEY, null);
  return /^N[1-5]$/i.test(String(st?.level || ''));
}

export function getLevel() {
  const st = getStore(APP_KEY, DEFAULT_APP);
  const lv = String(st?.level || 'N4').toUpperCase();
  return /^N[1-5]$/.test(lv) ? lv : 'N4';
}

export function setLevel(lv) {
  const normalized = String(lv || 'N4').toUpperCase();
  const valid = /^N[1-5]$/.test(normalized) ? normalized : 'N4';
  updateStore(APP_KEY, (c) => ({ ...c, level: valid }), DEFAULT_APP);
  const chip = document.getElementById('level-chip-label');
  if (chip) chip.textContent = valid;
  return valid;
}

export function setSession(on) {
  document.body.dataset.session = on ? '1' : '';
}