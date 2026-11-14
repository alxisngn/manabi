import { stripRuby } from './ruby.js';

let cachedVoice = null;

function getJapaneseVoice() {
  if (!('speechSynthesis' in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find((v) => v.lang === 'ja-JP' && v.localService) ||
    voices.find((v) => v.lang === 'ja-JP') ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ja')) ||
    null;
  return cachedVoice;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    getJapaneseVoice();
  };
}

export function speakJP(text = '', rate = 0.95) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = stripRuby(text);
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ja-JP';
    utter.rate = rate;
    const voice = getJapaneseVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.error('Lỗi phát âm TTS:', err);
  }
}