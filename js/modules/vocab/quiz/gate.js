import { PASS_RATE, recordTest } from '../../../core/progress.js';
import { shuffle, pickN, escapeHtml } from '../../../core/util.js';
import { isSameWord } from '../../../core/weak.js';

export function buildGateQuestions(lessonWords, poolWords, priorityWrong = []) {
  const wrongSet = new Set(priorityWrong.map((w) => `${w.jp}|${w.vi}`));
  const head = shuffle(lessonWords.filter((w) => wrongSet.has(`${w.jp}|${w.vi}`)));
  const tail = shuffle(lessonWords.filter((w) => !wrongSet.has(`${w.jp}|${w.vi}`)));
  const ordered = [...head, ...tail];
  const half = Math.ceil(ordered.length / 2);
  const dirs = shuffle(ordered.map((_, i) => (i < half ? 'jp-vi' : 'vi-jp')));

  return ordered.map((word, idx) => {
    const dir = dirs[idx];
    const normVi = (v) => String(v || '').trim().toLowerCase();
    const isValidDist = (cand) => !isSameWord(cand, word) && normVi(cand.vi) !== normVi(word.vi) && (dir === 'jp-vi' || cand.jp !== word.jp);
    const sameLessonValid = lessonWords.filter(isValidDist);
    let dist = pickN(sameLessonValid, 3, word, (w) => (dir === 'jp-vi' ? normVi(w.vi) : w.jp));
    if (dist.length < 3 && poolWords?.length) {
      const usedKeys = new Set(dist.map((w) => (dir === 'jp-vi' ? normVi(w.vi) : w.jp)));
      const extraValid = poolWords.filter((w) => isValidDist(w) && !usedKeys.has(dir === 'jp-vi' ? normVi(w.vi) : w.jp));
      dist = [...dist, ...pickN(extraValid, 3 - dist.length, word, (w) => (dir === 'jp-vi' ? normVi(w.vi) : w.jp))];
    }
    return { type: 'mcq', dir, word, weight: 1, options: shuffle([word, ...dist]), answered: false, correct: false, clearedWeak: false, chosenIdx: -1, typedVal: '' };
  });
}

export function evaluateGate(gate, score, total) {
  const rawPct = (score / total) * 100;
  const gateResult = { pct: Math.round(rawPct), passed: rawPct >= PASS_RATE * 100 };
  recordTest(gate.level, gate.skill || 'vocab', gate.lessonId, gateResult.pct);
  return gateResult;
}

export function renderGateResult(container, { gate, score, total, gateResult, wrongWords, onRetry, onNext, onExit }) {
  const { passed } = gateResult || { passed: false };
  const reqPct = Math.round(PASS_RATE * 100);
  const wrongListHtml = wrongWords.map((w) => `
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:var(--bg-elevated);border:1.5px solid var(--border);text-align:left;flex-wrap:wrap;">
      <div><span class="jp" style="font-weight:700;font-size:1.05rem;">${escapeHtml(w.jp)}</span>${w.reading ? ` <span class="jp" style="color:var(--teal);font-size:0.88rem;">(${escapeHtml(w.reading)})</span>` : ''}</div>
      <span style="color:var(--yellow);font-weight:700;font-size:0.92rem;">${escapeHtml(w.vi)}</span>
    </div>`).join('');

  container.innerHTML = `
    <div class="card ${passed ? 'anim-pop' : 'anim-shake'}" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:28px 20px;max-width:540px;margin:0 auto;">
      <div class="module-title" style="font-size:1.45rem;color:${passed ? 'var(--green)' : 'var(--coral)'};">
        ${passed ? `Hoàn thành ${escapeHtml(gate.lessonName)} 🎉` : `Đúng ${score}/${total} — cần ${reqPct}%`}
      </div>
      <p class="module-sub">${passed ? 'Bạn đã vượt qua bài kiểm tra!' : 'Các từ trả lời sai đã được lưu vào Từ cần ôn lại.'}</p>
      ${!passed && wrongWords.length ? `<div style="display:flex;flex-direction:column;gap:6px;">${wrongListHtml}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
        ${passed && gate.onNextLesson ? `<button type="button" id="gt-next-lesson" class="btn btn-teal">Bài tiếp theo (${escapeHtml(gate.nextLesson.name)}) →</button>` : ''}
        ${!passed ? `<button type="button" id="gt-retry" class="btn btn-yellow">↻ Làm lại</button>` : ''}
        <button type="button" id="qz-done" class="btn">← Về danh sách</button>
      </div>
    </div>`;
  container.querySelector('#gt-next-lesson')?.addEventListener('click', onNext);
  container.querySelector('#gt-retry')?.addEventListener('click', onRetry);
  container.querySelector('#qz-done').onclick = onExit;
}