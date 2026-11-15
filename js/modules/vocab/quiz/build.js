import { shuffle, pickN } from '../../../core/util.js';

export function buildQuestions(pool, allWords, count, forceMcqOnly = false) {
  const targets = shuffle(pool).slice(0, count);
  const src = allWords.length >= 4 ? allWords : pool;
  const qs = [];
  let i = 0;

  while (i < targets.length) {
    const rem = targets.length - i;
    const canMatch = !forceMcqOnly && src.length >= 6 && rem >= 6;
    const types = forceMcqOnly ? ['mcq'] : canMatch ? ['mcq', 'tf', 'match'] : ['mcq', 'tf'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'match') {
      const pairs = targets.slice(i, i + 6);
      qs.push({
        type: 'match',
        word: pairs[0],
        weight: pairs.length,
        left: shuffle(pairs),
        right: shuffle(pairs),
        matchedIds: [],
        mistakeIds: [],
        wrongLeftIdx: -1,
        wrongRightIdx: -1,
        selLeft: -1,
        selRight: -1,
        answered: false,
        correct: false
      });
      i += pairs.length;
    } else {
      const word = targets[i++];
      if (type === 'mcq') {
        const dist = pickN(src, 3, word, (w) => `${w.jp}|${w.vi}`);
        qs.push({ type: 'mcq', dir: 'jp-vi', word, weight: 1, options: shuffle([word, ...dist]), answered: false, correct: false, clearedWeak: false, chosenIdx: -1, typedVal: '' });
      } else {
        const isTrue = Math.random() < 0.5 || src.length < 2;
        const other = isTrue ? word : (pickN(src, 1, word, (w) => w.vi)[0] || word);
        qs.push({ type: 'tf', word, weight: 1, shownVi: other.vi, isMatch: other.vi === word.vi, answered: false, correct: false, clearedWeak: false, chosenVal: null });
      }
    }
  }
  return qs;
}