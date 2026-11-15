import { renderGateResult } from './gate.js';

export function renderResult(container, state, actions) {
  const { gate, isWeakReview, score, total, clearedCount, wrongWords, gateResult } = state;
  if (gate) {
    return renderGateResult(container, {
      gate,
      score,
      total,
      gateResult,
      wrongWords,
      onRetry: actions.onRetryGate,
      onNext: actions.onNextGate,
      onExit: actions.onExit
    });
  }

  const pct = Math.round((score / total) * 100);
  const summaryMsg = [
    clearedCount ? `Đã xóa ${clearedCount} từ thuộc khỏi Từ cần ôn lại.` : '',
    wrongWords.length ? `Còn ${wrongWords.length} từ sai cần ôn tiếp.` : 'Không còn từ sai nào!'
  ].filter(Boolean).join(' ');

  container.innerHTML = `
    <div class="card anim-pop" style="text-align:center;display:flex;flex-direction:column;gap:14px;padding:28px 20px;max-width:540px;margin:0 auto;">
      <div class="module-title" style="font-size:1.5rem;">${isWeakReview ? 'Hoàn thành Ôn tập!' : 'Hoàn thành Kiểm tra!'}</div>
      <div style="font-size:2.5rem;font-weight:800;color:var(--teal);">${score} / ${total} <span style="font-size:1.2rem;color:var(--yellow);">(${pct}%)</span></div>
      <p class="module-sub">${summaryMsg}</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
        ${wrongWords.length ? `<button type="button" id="qz-retry-wrong" class="btn btn-coral">🔥 Ôn tiếp ${wrongWords.length} từ sai</button>` : ''}
        ${!isWeakReview ? `<button type="button" id="qz-retry-all" class="btn btn-teal">↻ Làm đề mới</button>` : ''}
        <button type="button" id="qz-done" class="btn">← Quay lại</button>
      </div>
    </div>`;
  container.querySelector('#qz-retry-wrong')?.addEventListener('click', actions.onRetryWrong);
  container.querySelector('#qz-retry-all')?.addEventListener('click', actions.onRetryAll);
  container.querySelector('#qz-done').onclick = actions.onExit;
}