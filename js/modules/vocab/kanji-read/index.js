import { shuffle, pickN } from '../../../core/util.js';
import { speakJP } from '../../../core/tts.js';
import { STRIP_PUNCT, romajiToContextKana, isKanaMatch } from '../../../core/kana.js';
import { addWeak, isSameWord } from '../../../core/weak.js';
import { renderEmpty, renderResult, renderSession } from './ui.js';

const HAS_KANJI = /[\u4E00-\u9FAF]/;

const DAKUTEN_MAP = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ぶ', べ: 'へ', ぼ: 'ほ'
};

function makeTrickyReadings(reading) {
  const r = String(reading || '').trim();
  const traps = new Set();
  if (!r) return [];

  if (r.endsWith('う')) traps.add(r.slice(0, -1));
  else if (/[おうこそとのほもよろ]$/.test(r)) traps.add(`${r}う`);
  if (r.endsWith('い') && r.length > 2) traps.add(r.slice(0, -1));

  for (let i = 0; i < r.length; i++) {
    const swapped = DAKUTEN_MAP[r[i]];
    if (swapped) traps.add(r.slice(0, i) + swapped + r.slice(i + 1));
  }

  if (r.includes('っ')) traps.add(r.replace('っ', ''));
  else if (r.length >= 3) traps.add(r[0] + 'っ' + r.slice(1));

  traps.delete(r);
  return shuffle([...traps]);
}

function createQuestion(word, allWords, isRetry = false) {
  const correctReading = word.reading.trim();
  const distractorSet = new Set();
  const targetKanjis = [...word.jp].filter((c) => HAS_KANJI.test(c));

  const sharedKanjiPeers = allWords.filter(
    (w) => w.reading && w.reading.trim() !== correctReading && [...w.jp].some((c) => targetKanjis.includes(c))
  );
  for (const p of shuffle(sharedKanjiPeers)) {
    if (distractorSet.size < 2) distractorSet.add(p.reading.trim());
  }

  for (const trap of makeTrickyReadings(correctReading)) {
    if (distractorSet.size < 2) distractorSet.add(trap);
  }

  const sameLenPool = allWords.filter(
    (w) => w.reading && w.reading.trim() !== correctReading && Math.abs(w.reading.trim().length - correctReading.length) <= 1
  );
  for (const p of pickN(sameLenPool, 4, word, (w) => w.reading)) {
    if (distractorSet.size < 3 && p.reading.trim() !== correctReading) distractorSet.add(p.reading.trim());
  }

  if (distractorSet.size < 3) {
    for (const o of pickN(allWords.filter((w) => w.reading && w.reading.trim() !== correctReading), 3, word, (w) => w.reading)) {
      if (distractorSet.size < 3) distractorSet.add(o.reading.trim());
    }
  }

  return {
    word,
    correctReading,
    options: shuffle([correctReading, ...[...distractorSet].slice(0, 3)]),
    answered: false,
    correct: false,
    chosenIdx: -1,
    typedVal: '',
    isRetry
  };
}

export function mountKanjiRead(container, allWords = [], onBack) {
  const kanjiWords = allWords.filter((w) => w?.jp && w?.reading && HAS_KANJI.test(w.jp) && w.jp.trim() !== w.reading.trim());

  if (!kanjiWords.length) {
    renderEmpty(container, onBack);
    return;
  }

  let inputMode = 'mcq';
  let queue = shuffle(kanjiWords).map((w) => createQuestion(w, allWords, false));
  let qIdx = 0, firstPassCorrect = 0, soundOn = true, wrongWords = [], finished = false;
  let feedbackAnim = '';

  const onKeyDown = (e) => {
    if (!document.body.contains(container)) return document.removeEventListener('keydown', onKeyDown);
    if (finished || document.querySelector('dialog[open]')) return;
    const q = queue[qIdx];
    if (!q) return;
    if (!q.answered) {
      if (inputMode === 'mcq' && ['1', '2', '3', '4'].includes(e.key)) {
        container.querySelector(`.kr-opt[data-i="${Number(e.key) - 1}"]`)?.click();
      } else if (inputMode === 'type' && (e.key === '?' || (e.shiftKey && e.key === 'Enter'))) {
        e.preventDefault();
        container.querySelector('#kr-dont-know')?.click();
      }
    } else if (e.key === 'Enter' || (inputMode === 'mcq' && e.key === ' ')) {
      e.preventDefault();
      container.querySelector('#kr-next')?.click();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const exit = () => { document.removeEventListener('keydown', onKeyDown); if (onBack) onBack(); };

  function resetSession(wordsPool) {
    queue = shuffle(wordsPool).map((w) => createQuestion(w, allWords, false));
    qIdx = 0;
    firstPassCorrect = 0;
    wrongWords = [];
    finished = false;
    feedbackAnim = '';
    render();
  }

  function submitAnswer(q, isCorrect, extra = {}) {
    q.answered = true;
    q.correct = isCorrect;
    Object.assign(q, extra);
    feedbackAnim = isCorrect ? 'anim-pop' : 'anim-shake';

    if (isCorrect) {
      if (!q.isRetry) firstPassCorrect++;
    } else {
      addWeak(q.word);
      if (!wrongWords.some((x) => isSameWord(x, q.word))) wrongWords.push(q.word);
      const insertAt = Math.min(queue.length, qIdx + 4);
      queue.splice(insertAt, 0, createQuestion(q.word, allWords, true));
    }

    if (soundOn) speakJP(q.correctReading);
    render();
  }

  function render() {
    if (finished) {
      renderResult(container, {
        firstPassCorrect,
        totalUnique: kanjiWords.length,
        wrongCount: wrongWords.length,
        onRetryWrong: () => resetSession([...wrongWords]),
        onRetryAll: () => resetSession(kanjiWords),
        onExit: exit
      });
      return;
    }

    const q = queue[qIdx];
    const currentAnim = feedbackAnim;
    feedbackAnim = '';

    renderSession(container, {
      q,
      qIdx,
      totalQueue: queue.length,
      inputMode,
      soundOn,
      currentAnim,
      onToggleSound: () => { soundOn = !soundOn; render(); },
      onExit: exit,
      onSwitchMode: (mode) => {
        if (inputMode !== mode) { inputMode = mode; render(); }
      },
      onSpeak: () => speakJP(q.correctReading),
      onNext: () => {
        if (qIdx < queue.length - 1) { qIdx++; render(); }
        else { finished = true; render(); }
      },
      onChooseOpt: (idx) => submitAnswer(q, q.options[idx] === q.correctReading, { chosenIdx: idx }),
      onTypeInput: (val) => {
        const converted = romajiToContextKana(val, false, q.correctReading);
        q.typedVal = converted;
        return converted;
      },
      onTypeSubmit: (rawVal) => {
        if (q.answered) return;
        const displayKana = romajiToContextKana(rawVal, true, q.correctReading).replace(STRIP_PUNCT, '');
        if (!displayKana) return;
        submitAnswer(q, isKanaMatch(rawVal, q.correctReading, { includeJp: false }), { typedVal: displayKana });
      },
      onDontKnow: () => {
        if (!q.answered) submitAnswer(q, false, { typedVal: '(Bỏ qua)' });
      }
    });
  }

  render();
}