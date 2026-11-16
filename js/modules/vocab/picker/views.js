import { shuffle } from '../../../core/util.js';
import { getWeak } from '../../../core/weak.js';
import { fetchWords } from './data.js';

export async function buildGateConfig({ lessons, lessonItem, activeLevel, vocabSession, state, backToLevel, render }) {
  const repoList = lessons.filter((l) => l.source === 'repo');
  const idx = repoList.findIndex((x) => x.id === lessonItem.id);
  const words = await fetchWords(lessonItem, activeLevel);
  if (!words.length) return null;

  let poolWords = [...words];
  if (poolWords.length < 6 && repoList.length > 1) {
    const extras = repoList.filter((x) => x.id !== lessonItem.id).slice(0, 3);
    const extraBuckets = await Promise.all(extras.map((x) => fetchWords(x, activeLevel)));
    poolWords = [...poolWords, ...extraBuckets.flat()];
  }

  const nextLesson = idx >= 0 && idx < repoList.length - 1 ? repoList[idx + 1] : null;
  return {
    level: activeLevel,
    lessonId: lessonItem.id,
    lessonName: lessonItem.name,
    words,
    poolWords,
    nextLesson,
    onNextLesson: nextLesson ? async () => {
      const nextWords = shuffle(await fetchWords(nextLesson, activeLevel));
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

export async function applyQueryView({ params, lessons, store, activeLevel, vocabSession, state, ensureDistractorPool, launchGate }) {
  const viewParam = params.get('view');
  const gateParam = params.get('gate');
  const lessonParam = params.get('lesson');

  if (gateParam) {
    const target = lessons.find((l) => l.source === 'repo' && String(l.id) === String(gateParam));
    if (target) {
      await launchGate(target);
      return true;
    }
  } else if (lessonParam) {
    const target = lessons.find((l) => String(l.id) === String(lessonParam));
    if (target) {
      const words = shuffle(await fetchWords(target, activeLevel));
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