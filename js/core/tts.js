import { getStore, updateStore } from './store.js';
import { stripRuby } from './ruby.js';

const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS = { voiceURI: '', rate: 0.95 };
const NAMED_ORDER = [/o-?ren/i, /kyoko/i, /otoya/i, /haruka/i, /ayumi/i, /hattori/i];

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const isJaVoice = (v) => Boolean(v?.lang && v.lang.toLowerCase().startsWith('ja'));
const isGoogleVoice = (v) => Boolean(v?.name && v.name.includes('Google'));

function clampRate(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.min(2, Math.max(0.5, n)) : DEFAULT_SETTINGS.rate;
}

function getVoiceRank(v) {
  const name = v.name || '';
  if (isGoogleVoice(v)) return 0;
  if (/premium|enhanced|siri/i.test(name)) return 1;
  const namedIdx = NAMED_ORDER.findIndex((rx) => rx.test(name));
  if (namedIdx >= 0) return 2 + namedIdx;
  return 2 + NAMED_ORDER.length;
}

export function getVoiceSettings() {
  const raw = getStore(SETTINGS_KEY, DEFAULT_SETTINGS) || {};
  return {
    voiceURI: typeof raw.voiceURI === 'string' ? raw.voiceURI : '',
    rate: clampRate(raw.rate)
  };
}

export function setVoiceSettings(partial = {}) {
  const next = updateStore(SETTINGS_KEY, (cur) => {
    const base = { ...DEFAULT_SETTINGS, ...(cur || {}) };
    const merged = { ...base, ...(partial || {}) };
    return {
      ...merged,
      voiceURI: typeof merged.voiceURI === 'string' ? merged.voiceURI : '',
      rate: clampRate(merged.rate)
    };
  }, DEFAULT_SETTINGS);
  return { voiceURI: next.voiceURI, rate: next.rate };
}

export function getJapaneseVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter(isJaVoice)
    .sort((a, b) => {
      const diff = getVoiceRank(a) - getVoiceRank(b);
      if (diff !== 0) return diff;
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '', 'ja');
    });
}

function pickLocalFallback(voices) {
  return voices.find((v) => v.localService === true && !isGoogleVoice(v)) || null;
}

function selectVoice(voices, settings) {
  const online = isOnline();

  if (settings.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (chosen && (chosen.localService !== false || online)) {
      return chosen;
    }
  }

  if (online) {
    return voices[0] || null;
  }

  const offlineVoices = voices.filter((v) => !isGoogleVoice(v));
  return offlineVoices.find((v) => v.localService === true) || offlineVoices[0] || null;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    getJapaneseVoices();
  });
}

export function speakJP(text = '', rate) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = stripRuby(text);
    const settings = getVoiceSettings();
    const finalRate = typeof rate === 'number' && Number.isFinite(rate) ? rate : settings.rate;
    const voices = getJapaneseVoices();
    const voice = selectVoice(voices, settings);

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ja-JP';
    utter.rate = finalRate;
    if (voice) utter.voice = voice;

    if (voice && voice.localService === false) {
      let retried = false;
      utter.onerror = () => {
        if (retried) return;
        retried = true;
        const fallbackVoice = pickLocalFallback(getJapaneseVoices());
        if (!fallbackVoice) return;
        const retryUtter = new SpeechSynthesisUtterance(cleanText);
        retryUtter.lang = 'ja-JP';
        retryUtter.rate = finalRate;
        retryUtter.voice = fallbackVoice;
        window.speechSynthesis.speak(retryUtter);
      };
    }

    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.error('Lỗi phát âm TTS:', err);
  }
}