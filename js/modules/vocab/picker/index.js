import { getStore, updateStore } from '../../../core/store.js';
import { getLevel, setSession } from '../../../core/nav.js';
import { markStudied } from '../../../core/progress.js';
import { getStoreKey, DEFAULT_STORE, fetchRepo, buildLessons, fetchWords } from './data.js';
import { buildGateConfig, applyQueryView } from './views.js';
import { renderList, renderMix } from './lessonList.js';
import { renderModes } from './modeMenu.js';

export const meta = { id: 'vocab', name: 'Từ vựng', icon: '語' };
export const vocabSession = { words: [], lessonIds: [], lessonNames: [] };

export async function mount(container, { level, skill = 'vocab', query } = {}) {
  setSession(false);
  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải danh sách bài học...</p></div>`;
  const activeLevel = (level || getLevel()).toUpperCase();
  const activeSkill = skill.toLowerCase();
  const storeKey = getStoreKey(activeSkill);
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query || '');

  const repo = await fetchRepo(activeLevel, activeSkill);
  let store = getStore(storeKey, DEFAULT_STORE);
  const initialLessons = buildLessons(repo, store, activeLevel);

  const saved = (store.selectedIds || []).filter((id) => initialLessons.some((l) => l.id === id));
  const selectedSet = new Set(saved.length ? saved : initialLessons.filter((l) => l.source === 'repo').slice(0, 2).map((l) => l.id));
  const state = {
    step: 'list',
    impTab: 'upload',
    impTarget: 'user:weak',
    weakDirect: false,
    gateCfg: null,
    mixDirectMode: null,
    extraPoolWords: [],
    wordLimit: 20,
    useAllWords: false,
    loading: false,
    errMsg: ''
  };

  const baseRoute = `#/${activeLevel.toLowerCase()}/${activeSkill}`;
  const backToLevel = () => { if (window.location.hash !== baseRoute) window.location.hash = baseRoute; };
  const markSelectedStudied = () => {
    (vocabSession.lessonIds || []).forEach((id) => markStudied(activeLevel, activeSkill, id));
  };

  async function ensureDistractorPool() {
    if (state.extraPoolWords.length >= 12) return state.extraPoolWords;
    const repoList = ctx.lessons.filter((l) => l.source === 'repo').slice(0, 3);
    if (!repoList.length) return [];
    const buckets = await Promise.all(repoList.map((x) => fetchWords(x, activeLevel, activeSkill)));
    state.extraPoolWords = buckets.flat();
    return state.extraPoolWords;
  }

  async function launchGate(lessonItem) {
    const cfg = await buildGateConfig({
      lessons: ctx.lessons,
      lessonItem,
      activeLevel,
      skill: activeSkill,
      vocabSession,
      state,
      backToLevel,
      render
    });
    if (!cfg) { state.step = 'list'; return render(); }
    state.gateCfg = cfg;
    state.step = 'gate';
    render();
  }

  const refresh = () => {
    store = getStore(storeKey, DEFAULT_STORE);
    ctx.lessons = buildLessons(repo, store, activeLevel);
    for (const id of [...selectedSet]) if (!ctx.lessons.some((l) => l.id === id)) selectedSet.delete(id);
  };
  const saveSel = () => updateStore(storeKey, (c) => ({ ...c, selectedIds: [...selectedSet] }), DEFAULT_STORE);
  window.addEventListener('hashchange', () => setSession(false), { once: true });

  const ctx = {
    lessons: initialLessons,
    selectedSet,
    activeLevel,
    skill: activeSkill,
    storeKey,
    vocabSession,
    state,
    saveSel,
    ensureDistractorPool,
    launchGate,
    refresh,
    render
  };

  if (await applyQueryView({ params, lessons: ctx.lessons, store, activeLevel, skill: activeSkill, vocabSession, state, ensureDistractorPool, launchGate })) return;

  let navToken = 0;
  async function mountDynamicStep(token, backModes) {
    const { step } = state;
    if (step === 'gate' && state.gateCfg) {
      setSession(true);
      const { mountQuiz } = await import('../quiz.js');
      if (token === navToken) mountQuiz(container, state.gateCfg.words, backModes, { gate: state.gateCfg });
    } else if (step === 'flashcard') {
      markSelectedStudied(); setSession(true);
      const { mountFlashcard } = await import('../flashcard.js');
      if (token === navToken) mountFlashcard(container, vocabSession.words, backModes);
    } else if (step === 'kanji-read') {
      markSelectedStudied(); setSession(true);
      const { mountKanjiRead } = await import('../kanji-read.js');
      if (token === navToken) mountKanjiRead(container, vocabSession.words, backModes);
    } else if (step === 'match') {
      markSelectedStudied(); setSession(true);
      const { mountMatch } = await import('../match.js');
      if (token === navToken) mountMatch(container, vocabSession.words, backModes);
    } else if (step === 'quiz') {
      markSelectedStudied(); setSession(true);
      const { mountQuiz } = await import('../quiz.js');
      if (token === navToken) mountQuiz(container, vocabSession.words, backModes, { weakReview: state.weakDirect, poolWords: state.extraPoolWords });
    } else if (step === 'reflex') {
      markSelectedStudied(); setSession(true);
      const { mountReflex } = await import('../reflex.js');
      if (token === navToken) mountReflex(container, vocabSession.words, backModes);
    } else if (step === 'importer') {
      setSession(false);
      const { mountImporter } = await import('../importer.js');
      if (token === navToken) {
        mountImporter(container, () => { setSession(false); backToLevel(); refresh(); saveSel(); state.step = 'list'; render(); }, { tab: state.impTab, manageTarget: state.impTarget });
      }
    }
  }

  function render() {
    const token = ++navToken;
    const backModes = () => {
      setSession(false); refresh();
      if (state.weakDirect || state.step === 'gate' || state.mixDirectMode) {
        state.weakDirect = false; state.gateCfg = null; state.mixDirectMode = null; backToLevel(); state.step = 'list';
      } else {
        state.step = 'modes';
      }
      render();
    };
    const dynamicSteps = ['gate', 'flashcard', 'kanji-read', 'match', 'quiz', 'reflex', 'importer'];
    if (dynamicSteps.includes(state.step) && !(state.step === 'gate' && !state.gateCfg)) {
      mountDynamicStep(token, backModes);
      return;
    }
    setSession(false);
    if (state.step === 'mix') return renderMix(container, ctx);
    if (state.step === 'modes') {
      return renderModes(container, {
        lessons: ctx.lessons,
        vocabSession,
        onBack: () => { backToLevel(); refresh(); state.step = 'list'; render(); },
        onSelectMode: (modeId) => { state.step = modeId; render(); },
        onLaunchGate: launchGate
      });
    }
    renderList(container, ctx);
  }

  render();
}