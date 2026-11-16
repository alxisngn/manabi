import { escapeHtml, shuffle } from '../../../core/util.js';
import { updateStore } from '../../../core/store.js';
import { fetchWords, DEFAULT_STORE } from './data.js';

const allWordsCache = {};

async function loadAllSkillWords(lessons, level, skill) {
  const key = `${level}:${skill}`;
  if (allWordsCache[key]) return allWordsCache[key];
  const repoItems = lessons.filter((l) => l.source === 'repo');
  const buckets = await Promise.all(repoItems.map((l) => fetchWords(l, level, skill)));
  const flat = buckets.flat();
  allWordsCache[key] = flat;
  return flat;
}

export function renderKanjiFilterCard(activeLevel, existingCount = 0) {
  const defaultTitle = `So-matome Day ${existingCount + 1}`;
  return `
    <div class="card col mb-12 pk-card-yellow">
      <div class="row-between">
        <div class="module-title">📒 Tạo Album ôn So-matome</div>
        <span class="badge badge-ready">JLPT ${escapeHtml(activeLevel)}</span>
      </div>
      <p class="module-sub">Nhập tên buổi học & các chữ Hán vừa học để gom từ ghép từ kho Riki và lưu lại:</p>
      <input type="text" id="kj-album-name" class="inp" value="${escapeHtml(defaultTitle)}" placeholder="Tên Album (VD: So-matome Day 1)" />
      <div class="pk-rng-row">
        <input type="text" id="kj-filter-inp" class="inp" placeholder="Gõ chữ Hán vừa học (VD: 家族兄弟)..." autocomplete="off" />
        <button type="button" id="kj-filter-go" class="btn btn-yellow">Lưu & Ôn →</button>
      </div>
      <div id="kj-filter-msg" class="pk-err"></div>
    </div>`;
}

export function bindKanjiFilter(container, ctx) {
  const nameInp = container.querySelector('#kj-album-name');
  const inp = container.querySelector('#kj-filter-inp');
  const btn = container.querySelector('#kj-filter-go');
  const msg = container.querySelector('#kj-filter-msg');
  if (!inp || !btn || !msg) return;

  const runSaveAndStudy = async () => {
    const raw = inp.value.trim();
    const chars = [...new Set(raw.match(/[\u4E00-\u9FAF]/g) || [])];
    if (!chars.length) {
      msg.textContent = 'Vui lòng nhập ít nhất 1 chữ Hán (ví dụ: 家族).';
      return;
    }
    btn.disabled = true;
    msg.textContent = 'Đang gom từ vựng từ kho Kanji...';
    const allWords = await loadAllSkillWords(ctx.lessons, ctx.activeLevel, ctx.skill);
    btn.disabled = false;

    const matched = [];
    const seen = new Set();
    allWords.forEach((w) => {
      const hit = chars.some((ch) => w.kanji === ch || String(w.jp || '').includes(ch));
      if (hit && !seen.has(w.jp)) {
        seen.add(w.jp);
        matched.push({ ...w });
      }
    });

    if (!matched.length) {
      msg.textContent = `Không tìm thấy từ nào chứa: ${chars.join(', ')}`;
      return;
    }

    const baseName = (nameInp?.value || '').trim() || `So-matome (${chars.join('')})`;
    const albumName = `${baseName} (${chars.join('')})`;
    const albumId = `album-${Date.now()}`;

    updateStore(ctx.storeKey, (cur) => {
      const list = Array.isArray(cur?.customLessons) ? [...cur.customLessons] : [];
      list.unshift({ id: albumId, name: albumName, words: matched });
      return { ...cur, customLessons: list };
    }, DEFAULT_STORE);

    ctx.refresh?.();
    msg.textContent = '';
    ctx.vocabSession.words = shuffle(matched);
    ctx.vocabSession.lessonIds = [albumId];
    ctx.vocabSession.lessonNames = [albumName];
    ctx.state.weakDirect = false;
    ctx.state.mixDirectMode = null;
    ctx.state.step = 'modes';
    ctx.render();
  };

  btn.onclick = runSaveAndStudy;
  inp.onkeydown = (e) => { if (e.key === 'Enter') runSaveAndStudy(); };
}