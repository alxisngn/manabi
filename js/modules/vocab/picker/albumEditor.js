import { escapeHtml } from '../../../core/util.js';
import { updateStore } from '../../../core/store.js';
import { DEFAULT_STORE } from './data.js';

export function renderAlbumEditor(container, ctx, albumId) {
  const album = ctx.lessons.find((l) => l.id === albumId && l.source === 'local');
  if (!album) {
    ctx.state.editAlbumId = null;
    ctx.render();
    return;
  }

  let words = [...(album.words || [])];
  let name = album.name;
  let errMsg = '';

  const saveChanges = (nextWords, nextName) => {
    const nowIso = new Date().toISOString();
    updateStore(ctx.storeKey, (cur) => {
      const list = (cur?.customLessons || []).map((cl) =>
        String(cl.id) === String(albumId) ? { ...cl, name: nextName, words: nextWords, updatedAt: nowIso } : cl
      );
      return { ...cur, customLessons: list };
    }, DEFAULT_STORE);
    ctx.refresh?.();
  };

  const deleteAlbum = () => {
    const nowIso = new Date().toISOString();
    updateStore(ctx.storeKey, (cur) => {
      const list = (cur?.customLessons || []).map((cl) =>
        String(cl.id) === String(albumId) ? { ...cl, deletedAt: nowIso, updatedAt: nowIso } : cl
      );
      return { ...cur, customLessons: list };
    }, DEFAULT_STORE);
    ctx.refresh?.();
    ctx.state.editAlbumId = null;
    ctx.render();
  };

  const draw = () => {
    const rowsHtml = words.map((w, idx) => `
      <div class="card row-between">
        <div>
          <div class="pk-item-title">${escapeHtml(w.jp)} <span class="text-muted text-sm">(${escapeHtml(w.reading)})</span></div>
          <div class="module-sub">${escapeHtml(w.vi)}</div>
        </div>
        <button type="button" class="btn btn-icon btn-sm" data-del="${idx}" title="Xóa từ này">✕</button>
      </div>`).join('');

    container.innerHTML = `
      <div class="row-between mb-12">
        <button type="button" id="alb-back" class="btn">← Quay lại</button>
        <button type="button" id="alb-delete" class="btn btn-coral btn-sm">🗑 Xóa Album</button>
      </div>
      <div class="card col mb-12">
        <div class="module-title">Chỉnh sửa Album (${words.length} từ)</div>
        <div class="pk-rng-row">
          <input type="text" id="alb-name" class="inp" value="${escapeHtml(name)}" placeholder="Tên Album..." />
          <button type="button" id="alb-rename" class="btn btn-teal">Đổi tên</button>
        </div>
      </div>
      <div class="card col mb-12">
        <div class="module-title">＋ Thêm từ lẻ từ So-matome</div>
        <div class="col gap-8">
          <input type="text" id="alb-add-jp" class="inp" placeholder="Từ tiếng Nhật (VD: 家族)" />
          <div class="grid-2">
            <input type="text" id="alb-add-rd" class="inp" placeholder="Cách đọc (かぞく)" />
            <input type="text" id="alb-add-vi" class="inp" placeholder="Nghĩa (Gia đình)" />
          </div>
          ${errMsg ? `<div class="pk-err">${escapeHtml(errMsg)}</div>` : ''}
          <button type="button" id="alb-add-btn" class="btn btn-yellow w-full">Thêm vào Album</button>
        </div>
      </div>
      <div class="pk-sec-lbl mb-8">Danh sách từ trong Album</div>
      <div class="module-grid">${rowsHtml || `<p class="module-sub">Album chưa có từ nào.</p>`}</div>
    `;

    container.querySelector('#alb-back').onclick = () => { ctx.state.editAlbumId = null; ctx.render(); };
    container.querySelector('#alb-delete').onclick = deleteAlbum;
    container.querySelector('#alb-rename').onclick = () => {
      const next = container.querySelector('#alb-name').value.trim();
      if (!next) return;
      name = next;
      saveChanges(words, name);
      draw();
    };
    container.querySelector('#alb-add-btn').onclick = () => {
      const jp = container.querySelector('#alb-add-jp').value.trim();
      const reading = container.querySelector('#alb-add-rd').value.trim();
      const vi = container.querySelector('#alb-add-vi').value.trim();
      if (!jp || !reading || !vi) {
        errMsg = 'Vui lòng điền đủ Từ Nhật, Cách đọc và Nghĩa.';
        return draw();
      }
      errMsg = '';
      words = [{ jp, reading, vi, pos: 'noun' }, ...words];
      saveChanges(words, name);
      draw();
    };
    container.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.del);
        words = words.filter((_, idx) => idx !== i);
        saveChanges(words, name);
        draw();
      };
    });
  };

  draw();
}