import { getStore, updateStore } from '../../core/store.js';
import { shuffle, escapeHtml } from '../../core/util.js';
import { mountFlashcard } from './flashcard.js';

export const meta = {
  id: 'vocab',
  name: 'Từ vựng',
  icon: '語'
};

export const vocabSession = {
  words: [],
  lessonIds: [],
  lessonNames: []
};

const STORE_KEY = 'vocab';
const DEFAULT_STORE = {
  selectedIds: [],
  customLessons: [],
  openWords: [],
  weakWords: []
};

const MODES = [
  { id: 'flashcard', name: 'Học từ mới', sub: 'Lật thẻ Flashcard & nghe phát âm', icon: '🃏', accent: 'accent-teal', ready: true },
  { id: 'match', name: 'Ghép thẻ', sub: 'Nối nhanh từ tiếng Nhật và nghĩa', icon: '🧩', accent: 'accent-yellow', ready: false },
  { id: 'quiz', name: 'Kiểm tra', sub: 'Trắc nghiệm 4 đáp án & lưu từ yếu', icon: '📝', accent: 'accent-coral', ready: false },
  { id: 'reflex', name: 'Luyện phản xạ', sub: 'Đếm ngược tốc độ cao từng từ', icon: '⚡', accent: 'accent-teal', ready: false }
];

let repoLessonsCache = null;

async function fetchRepoLessons() {
  if (repoLessonsCache) return repoLessonsCache;
  try {
    const res = await fetch('data/vocab/index.json');
    if (!res.ok) return [];
    const data = await res.json();
    repoLessonsCache = Array.isArray(data?.lessons) ? data.lessons : [];
    return repoLessonsCache;
  } catch {
    return [];
  }
}

function buildAllLessons(repoLessons, store) {
  const list = repoLessons.map((l) => ({
    id: l.id,
    name: l.name,
    file: l.file,
    count: Number(l.count) || 0,
    source: 'repo'
  }));

  if (Array.isArray(store.openWords) && store.openWords.length > 0) {
    list.push({
      id: 'user:open',
      name: 'Từ ngoài sách (Open)',
      count: store.openWords.length,
      words: store.openWords,
      source: 'local'
    });
  }

  if (Array.isArray(store.weakWords) && store.weakWords.length > 0) {
    list.push({
      id: 'user:weak',
      name: 'Từ yếu cần ôn',
      count: store.weakWords.length,
      words: store.weakWords,
      source: 'local'
    });
  }

  if (Array.isArray(store.customLessons)) {
    store.customLessons.forEach((cl) => {
      if (cl?.id && Array.isArray(cl.words) && cl.words.length > 0) {
        list.push({
          id: String(cl.id),
          name: cl.name || 'Bài tự thêm',
          count: cl.words.length,
          words: cl.words,
          source: 'local'
        });
      }
    });
  }

  return list;
}

async function loadSelectedWords(selectedLessons) {
  const merged = [];
  for (const item of selectedLessons) {
    if (item.source === 'local' && Array.isArray(item.words)) {
      merged.push(...item.words);
    } else if (item.file) {
      try {
        const res = await fetch(`data/vocab/${item.file}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.words)) merged.push(...data.words);
        }
      } catch (err) {
        console.error(`Lỗi tải bài ${item.file}:`, err);
      }
    }
  }
  return shuffle(merged);
}

export async function mount(container) {
  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải danh sách bài học...</p></div>`;

  const repoLessons = await fetchRepoLessons();
  let store = getStore(STORE_KEY, DEFAULT_STORE);
  let lessons = buildAllLessons(repoLessons, store);

  const validSavedIds = (store.selectedIds || []).filter((id) => lessons.some((l) => l.id === id));
  const selectedSet = new Set(validSavedIds.length ? validSavedIds : (lessons[0] ? [lessons[0].id] : []));

  let step = 'pick';
  let isLoadingWords = false;
  let errorMsg = '';

  function refreshLessonsFromStore() {
    store = getStore(STORE_KEY, DEFAULT_STORE);
    lessons = buildAllLessons(repoLessons, store);
  }

  function saveSelection() {
    updateStore(STORE_KEY, (cur) => ({ ...cur, selectedIds: [...selectedSet] }), DEFAULT_STORE);
  }

  function getSelectedStats() {
    const picked = lessons.filter((l) => selectedSet.has(l.id));
    const totalWords = picked.reduce((sum, l) => sum + l.count, 0);
    return { picked, totalWords };
  }

  function render() {
    if (step === 'flashcard') {
      mountFlashcard(container, vocabSession.words, () => {
        refreshLessonsFromStore();
        step = 'modes';
        render();
      });
    } else if (step === 'modes') {
      renderModeMenu();
    } else {
      renderLessonPicker();
    }
  }

  function renderLessonPicker() {
    const { picked, totalWords } = getSelectedStats();
    const allChecked = lessons.length > 0 && selectedSet.size === lessons.length;

    const listHtml = lessons.length === 0
      ? `<p class="module-sub">Chưa có bài học nào trong data/vocab/index.json hoặc bộ nhớ máy.</p>`
      : lessons.map((l) => {
          const checked = selectedSet.has(l.id);
          return `
            <label class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer;border-color:${checked ? 'var(--teal)' : 'var(--border)'};">
              <span style="display:flex;align-items:center;gap:12px;font-weight:700;font-size:1.05rem;">
                <input type="checkbox" class="lesson-cb" value="${escapeHtml(l.id)}" ${checked ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--teal);cursor:pointer;">
                <span>${escapeHtml(l.name)}</span>
              </span>
              <span class="badge ${checked ? 'badge-ready' : ''}">${l.count} từ</span>
            </label>
          `;
        }).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">
        <a href="#/" class="btn">← Trang chủ</a>
        <button type="button" id="btn-toggle-all" class="btn" ${lessons.length === 0 ? 'disabled' : ''}>
          ${allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
      </div>

      <div class="card" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div class="module-title">Chọn bài Từ vựng</div>
          <div class="module-sub">Đã chọn <strong>${picked.length}</strong> bài • Tổng <strong>${totalWords}</strong> từ</div>
        </div>
        <button type="button" id="btn-start" class="btn btn-teal" ${picked.length === 0 || isLoadingWords ? 'disabled' : ''}>
          ${isLoadingWords ? 'Đang nạp...' : 'Bắt đầu →'}
        </button>
      </div>

      ${errorMsg ? `<p style="color:var(--red);font-weight:700;margin-bottom:12px;">${escapeHtml(errorMsg)}</p>` : ''}

      <div class="module-grid">${listHtml}</div>
    `;

    container.querySelectorAll('.lesson-cb').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = e.target.value;
        if (e.target.checked) selectedSet.add(id);
        else selectedSet.delete(id);
        errorMsg = '';
        saveSelection();
        renderLessonPicker();
      });
    });

    container.querySelector('#btn-toggle-all')?.addEventListener('click', () => {
      if (allChecked) selectedSet.clear();
      else lessons.forEach((l) => selectedSet.add(l.id));
      errorMsg = '';
      saveSelection();
      renderLessonPicker();
    });

    container.querySelector('#btn-start')?.addEventListener('click', async () => {
      if (picked.length === 0) return;
      isLoadingWords = true;
      errorMsg = '';
      renderLessonPicker();

      const words = await loadSelectedWords(picked);
      isLoadingWords = false;

      if (words.length === 0) {
        errorMsg = 'Không tìm thấy từ vựng nào trong các bài đã chọn.';
        renderLessonPicker();
        return;
      }

      vocabSession.words = words;
      vocabSession.lessonIds = picked.map((l) => l.id);
      vocabSession.lessonNames = picked.map((l) => l.name);
      step = 'modes';
      render();
    });
  }

  function renderModeMenu() {
    const modesHtml = MODES.map((m) => `
      <div class="card module-card ${m.ready ? 'is-active' : 'is-disabled'}" data-mode="${m.id}" aria-disabled="${!m.ready}">
        <div class="module-left">
          <div class="module-icon ${m.accent}">${m.icon}</div>
          <div>
            <div class="module-title">${m.name}</div>
            <div class="module-sub">${m.sub}</div>
          </div>
        </div>
        <span class="badge ${m.ready ? 'badge-ready' : ''}">${m.ready ? 'Bắt đầu →' : 'Sắp có'}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">
        <button type="button" id="btn-back-pick" class="btn">← Đổi bài học</button>
        <span class="badge badge-ready">Đã trộn ${vocabSession.words.length} từ</span>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="module-title">Chọn chế độ luyện tập</div>
        <div class="module-sub">Bài đang gộp: ${escapeHtml(vocabSession.lessonNames.join(', '))}</div>
      </div>

      <div class="module-grid">${modesHtml}</div>
    `;

    container.querySelector('#btn-back-pick')?.addEventListener('click', () => {
      refreshLessonsFromStore();
      step = 'pick';
      render();
    });

    container.querySelectorAll('.module-card.is-active').forEach((card) => {
      card.addEventListener('click', () => {
        const mode = card.dataset.mode;
        if (mode === 'flashcard') {
          step = 'flashcard';
          render();
        }
      });
    });
  }

  render();
}