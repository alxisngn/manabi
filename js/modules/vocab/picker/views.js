import { shuffle } from '../../../core/util.js';
import { getWeak } from '../../../core/weak.js';
import { fetchWords } from './data.js';

export async function buildGateConfig({ lessons, lessonItem, activeLevel, skill = 'vocab', vocabSession, state, backToLevel, render }) {
  const sameSourceList = lessons.filter((l) => l.source === lessonItem.source && !String(l.id).startsWith('user:'));
  const idx = sameSourceList.findIndex((x) => String(x.id) === String(lessonItem.id));
  const words = await fetchWords(lessonItem, activeLevel, skill);
  if (!words.length) return null;

  let poolWords = [...words];
  if (poolWords.length < 6) {
    const repoFallback = lessons.filter((l) => l.source === 'repo' && String(l.id) !== String(lessonItem.id)).slice(0, 3);
    const extraBuckets = await Promise.all(repoFallback.map((x) => fetchWords(x, activeLevel, skill)));
    poolWords = [...poolWords, ...extraBuckets.flat()];
  }

  const nextLesson = idx >= 0 && idx < sameSourceList.length - 1 ? sameSourceList[idx + 1] : null;
  return {
    level: activeLevel,
    skill,
    lessonId: lessonItem.id,
    lessonName: lessonItem.name,
    words,
    poolWords,
    nextLesson,
    onNextLesson: nextLesson ? async () => {
      const nextWords = shuffle(await fetchWords(nextLesson, activeLevel, skill));
      state.gateCfg = null;
      state.weakDirect = false;
      state.mixDirectMode = null;
      if (window.location.hash.includes('gate=')) backToLevel();
      if (!nextWords.length) {
        state.step = 'list';
        return render();
      }
      vocabSession.words = nextWords;
      vocabSession.lessonIds = [nextLesson.id];
      vocabSession.lessonNames = [nextLesson.name];
      state.step = 'modes';
      render();
    } : null
  };
}

export async function applyQueryView({ params, lessons, store, activeLevel, skill = 'vocab', vocabSession, state, ensureDistractorPool, launchGate }) {
  const viewParam = params.get('view');
  const gateParam = params.get('gate');
  const lessonParam = params.get('lesson');

  if (gateParam) {
    const target = lessons.find((l) => String(l.id) === String(gateParam) && !String(l.id).startsWith('user:'));
    if (target) {
      await launchGate(target);
      return true;
    }
  } else if (lessonParam) {
    const target = lessons.find((l) => String(l.id) === String(lessonParam));
    if (target) {
      const words = shuffle(await fetchWords(target, activeLevel, skill));
      if (words.length) {
        vocabSession.words = words;
        vocabSession.lessonIds = [target.id];
        vocabSession.lessonNames = [target.name];
        state.weakDirect = target.id === 'user:weak';
        if (state.weakDirect) await ensureDistractorPool();
        state.step = state.weakDirect ? 'quiz' : 'modes';
      }
    }
  } else if (viewParam === 'study-weak' && getWeak().length) {
    await ensureDistractorPool();
    vocabSession.words = shuffle(getWeak());
    vocabSession.lessonIds = [];
    vocabSession.lessonNames = ['Từ cần ôn lại'];
    state.weakDirect = true;
    state.step = 'quiz';
  } else if (viewParam === 'study-open' && store.openWords?.length) {
    vocabSession.words = shuffle(store.openWords);
    vocabSession.lessonIds = [];
    vocabSession.lessonNames = ['Từ mở rộng'];
    state.step = 'modes';
  } else if (['weak', 'open', 'manage'].includes(viewParam)) {
    state.step = 'importer';
    state.impTab = 'manage';
    state.impTarget = viewParam === 'open' ? 'user:open' : 'user:weak';
  } else if (viewParam === 'add') {
    state.step = 'importer';
    state.impTab = 'upload';
  }
  return false;
}