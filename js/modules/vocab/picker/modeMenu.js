import { escapeHtml } from '../../../core/util.js';

export const MODES = [
  { id: 'flashcard', name: 'Học từ mới', sub: 'Lật thẻ Flashcard & nghe phát âm', icon: '🃏', accent: 'accent-teal' },
  { id: 'kanji-read', name: 'Đọc Kanji', sub: 'Nhìn chữ Hán chọn cách đọc Hiragana & bẫy biến âm', icon: '漢', accent: 'accent-yellow' },
  { id: 'match', name: 'Trò chơi ghép thẻ', sub: 'Nối nhanh từ tiếng Nhật và nghĩa theo đồng hồ', icon: '🧩', accent: 'accent-yellow' },
  { id: 'quiz', name: 'Kiểm tra', sub: 'Trắc nghiệm, Đúng/Sai, Nối cặp & lưu từ cần ôn', icon: '📝', accent: 'accent-coral' },
  { id: 'reflex', name: 'Luyện phản xạ', sub: 'Nghe hiểu & Thử thách tốc độ 5 giây/câu', icon: '⚡', accent: 'accent-teal' }
];

export function renderModes(container, { lessons, vocabSession, onBack, onSelectMode, onLaunchGate }) {
  const singleRepoLesson = vocabSession.lessonIds?.length === 1
    ? lessons.find((l) => l.source === 'repo' && String(l.id) === String(vocabSession.lessonIds[0]))
    : null;

  const gateCardHtml = singleRepoLesson ? `
    <div class="card module-card is-active" id="m-start-gate" style="border-color:var(--teal);">
      <div class="module-left">
        <div class="module-icon accent-teal">🏆</div>
        <div>
          <div class="module-title">Kiểm tra qua bài</div>
          <div class="module-sub">Đạt từ 80% trở lên để đánh dấu đã qua ${escapeHtml(singleRepoLesson.name)}</div>
        </div>
      </div>
      <span class="badge badge-ready">Thi ngay →</span>
    </div>` : '';

  const modesHtml = MODES.map((m) => `
    <div class="card module-card is-active" data-mode="${m.id}">
      <div class="module-left"><div class="module-icon ${m.accent}">${m.icon}</div><div><div class="module-title">${m.name}</div><div class="module-sub">${m.sub}</div></div></div>
      <span class="badge badge-ready">Vào →</span>
    </div>`).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
      <button type="button" id="m-back" class="btn">← Đổi bài</button>
      <span class="badge badge-ready">${vocabSession.words.length} từ</span>
    </div>
    <div class="card" style="margin-bottom:12px;"><div class="module-title">${escapeHtml(vocabSession.lessonNames.join(', '))}</div><div class="module-sub">Chọn chế độ luyện tập bên dưới</div></div>
    <div class="module-grid">${modesHtml}${gateCardHtml}</div>`;

  container.querySelector('#m-back').onclick = onBack;
  container.querySelectorAll('.module-card[data-mode]').forEach((c) => {
    c.onclick = () => onSelectMode(c.dataset.mode);
  });
  container.querySelector('#m-start-gate')?.addEventListener('click', async (e) => {
    e.currentTarget.style.pointerEvents = 'none';
    await onLaunchGate(singleRepoLesson);
  });
}