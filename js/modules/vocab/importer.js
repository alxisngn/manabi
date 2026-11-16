import { getStore, updateStore, exportBackup, importBackup } from '../../core/store.js';
import { uid, escapeHtml } from '../../core/util.js';
import { getWeak, addWeak, clearWeak } from '../../core/weak.js';

const STORE_KEY = 'vocab';
const POS = ['noun', 'verb', 'adj', 'adv', 'other'];
const norm = (w = {}) => ({
  jp: String(w.jp || '').trim(),
  reading: String(w.reading || '').trim(),
  vi: String(w.vi || '').trim(),
  pos: POS.includes(w.pos) ? w.pos : 'other',
  ex: String(w.ex || '').trim(),
  exVi: String(w.exVi || '').trim()
});

function parseCSV(text) {
  const rows = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!rows.length) throw new Error('File CSV trống.');
  const split = (line) => {
    const res = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') q = !q;
      else if (line[i] === ',' && !q) { res.push(cur.trim()); cur = ''; }
      else cur += line[i];
    }
    res.push(cur.trim());
    return res;
  };
  let start = 0;
  const first = split(rows[0]).map(s => s.toLowerCase());
  if (first.includes('jp') || first.includes('vi') || first[0] === 'từ') start = 1;
  const words = rows.slice(start).map((r, idx) => {
    const [jp = '', reading = '', vi = '', pos = 'other', ex = '', exVi = ''] = split(r);
    if (!jp || !vi) throw new Error(`Dòng ${idx + start + 1}: Thiếu từ tiếng Nhật (cột 1) hoặc nghĩa (cột 3).`);
    return norm({ jp, reading, vi, pos, ex, exVi });
  });
  if (!words.length) throw new Error('Không tìm thấy dữ liệu từ vựng hợp lệ trong CSV.');
  return { name: '', words };
}

function parseFileText(filename, text) {
  if (filename.toLowerCase().endsWith('.csv')) return parseCSV(text);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('File JSON bị lỗi cú pháp.'); }
  const raw = Array.isArray(data) ? data : data?.words;
  if (!Array.isArray(raw) || !raw.length) throw new Error('JSON phải là mảng từ hoặc có mảng "words" không rỗng.');
  const words = raw.map((w, i) => {
    if (!w || !String(w.jp || '').trim() || !String(w.vi || '').trim()) {
      throw new Error(`Mục #${i + 1} thiếu trường bắt buộc "jp" hoặc "vi".`);
    }
    return norm(w);
  });
  return { name: data?.lesson?.name || data?.name || filename.replace(/\.[^.]+$/, ''), words };
}

export function mountImporter(container, onBack, init = {}) {
  let tab = init.tab || 'upload', msg = '', isErr = false;
  let preview = [], lessonName = '', conflictName = '';
  let manageTarget = init.manageTarget || 'user:weak', confirmClear = false;

  const getVocabStore = () => getStore(STORE_KEY, { customLessons: [], openWords: [] });
  const setStatus = (t, err = false) => { msg = t; isErr = err; };
  const posOpts = (val) => POS.map(p => `<option value="${p}" ${p === val ? 'selected' : ''}>${p}</option>`).join('');

  function saveUploaded(mode = 'new') {
    const name = lessonName.trim();
    if (!name) { setStatus('Vui lòng nhập tên bài học.', true); render(); return; }
    const valid = preview.map(norm).filter(w => w.jp && w.vi);
    if (!valid.length) { setStatus('Cần ít nhất 1 từ đủ chữ Nhật và nghĩa.', true); render(); return; }

    const st = getVocabStore();
    const existing = (st.customLessons || []).find(l => l.name.toLowerCase() === name.toLowerCase());
    if (existing && mode === 'new') { conflictName = existing.name; render(); return; }
    updateStore(STORE_KEY, (cur) => {
      const list = [...(cur.customLessons || [])];
      const idx = list.findIndex(l => l.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0 && mode === 'merge') list[idx] = { ...list[idx], words: [...list[idx].words, ...valid] };
      else if (idx >= 0 && mode === 'replace') list[idx] = { ...list[idx], words: valid };
      else list.push({ id: uid('custom'), name, words: valid });
      return { ...cur, customLessons: list };
    });
    preview = []; lessonName = ''; conflictName = '';
    setStatus(`Đã lưu bài "${name}" (${valid.length} từ)!`);
    render();
  }

  function renderUpload() {
    const rows = preview.map((w, i) => `
      <div class="imp-word-card">
        <div class="imp-grid-jp">
          <input class="inp p-inp" data-i="${i}" data-k="jp" value="${escapeHtml(w.jp)}" placeholder="Từ JP *">
          <input class="inp p-inp" data-i="${i}" data-k="reading" value="${escapeHtml(w.reading)}" placeholder="Cách đọc">
          <button type="button" class="btn btn-icon p-del imp-danger-txt" data-i="${i}">✕</button>
        </div>
        <div class="imp-grid-vi">
          <input class="inp p-inp" data-i="${i}" data-k="vi" value="${escapeHtml(w.vi)}" placeholder="Nghĩa tiếng Việt *">
          <select class="inp p-inp" data-i="${i}" data-k="pos">${posOpts(w.pos)}</select>
        </div>
        <input class="inp p-inp" data-i="${i}" data-k="ex" value="${escapeHtml(w.ex)}" placeholder="Ví dụ (vd: 日本[にほん]へ行きます)">
        <input class="inp p-inp" data-i="${i}" data-k="exVi" value="${escapeHtml(w.exVi)}" placeholder="Nghĩa câu ví dụ">
      </div>`).join('');

    return `
      <div class="card col">
        <p class="module-sub">Hỗ trợ JSON (mảng words hoặc format bài) và CSV (cột: jp, reading, vi, pos, ex, exVi).</p>
        <label class="btn btn-teal w-full">
          📂 Chọn file JSON / CSV
          <input type="file" id="up-file" accept=".json,.csv,application/json,text/csv" hidden>
        </label>
        ${preview.length ? `
          <input id="up-name" class="inp" value="${escapeHtml(lessonName)}" placeholder="Nhập tên bài mới...">
          ${conflictName ? `
            <div class="imp-conflict">
              <div class="text-base imp-conflict-title">Bài "${escapeHtml(conflictName)}" đã tồn tại. Bạn muốn:</div>
              <div class="row">
                <button type="button" id="btn-merge" class="btn btn-teal grow">Gộp thêm</button>
                <button type="button" id="btn-replace" class="btn btn-coral grow">Thay thế</button>
              </div>
            </div>` : `<button type="button" id="btn-save-up" class="btn btn-yellow">💾 Lưu bài (${preview.length} từ)</button>`}
          <div class="imp-scroll-list">${rows}</div>
        ` : ''}
      </div>`;
  }

  function renderManual(st) {
    const opts = [
      `<option value="user:open">Từ mở rộng (ngoài giáo trình)</option>`,
      ...(st.customLessons || []).map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`)
    ].join('');
    return `
      <form id="form-manual" class="card imp-manual-form">
        <label class="imp-lbl">Lưu vào nhóm</label>
        <select name="target" class="inp">${opts}</select>
        <div class="grid-2">
          <input name="jp" class="inp" placeholder="Từ tiếng Nhật *" required>
          <input name="reading" class="inp" placeholder="Cách đọc (Hiragana)">
        </div>
        <div class="imp-grid-vi-lg">
          <input name="vi" class="inp" placeholder="Nghĩa tiếng Việt *" required>
          <select name="pos" class="inp">${posOpts('noun')}</select>
        </div>
        <input name="ex" class="inp" placeholder="Câu ví dụ (vd: 漢字[かんじ]を勉強[べんきょう]する)">
        <input name="exVi" class="inp" placeholder="Nghĩa câu ví dụ">
        <button type="submit" class="btn btn-teal imp-submit-btn">＋ Thêm từ vựng</button>
      </form>`;
  }

  function renderManage(st) {
    const weakWords = getWeak();
    const targets = [
      { id: 'user:weak', name: `📌 Từ cần ôn lại (${weakWords.length} từ)`, words: weakWords, isCustom: false },
      { id: 'user:open', name: `📖 Từ mở rộng (${(st.openWords || []).length} từ)`, words: st.openWords || [], isCustom: false },
      ...(st.customLessons || []).map(l => ({ id: l.id, name: `${l.name} (${l.words.length} từ)`, words: l.words, isCustom: true }))
    ];
    if (!targets.some(t => t.id === manageTarget)) manageTarget = 'user:weak';
    const cur = targets.find(t => t.id === manageTarget) || targets[0];
    const showBulkBtn = cur.isCustom || cur.words.length > 0;
    const bulkLabel = confirmClear ? 'Xác nhận?' : (cur.isCustom ? 'Xóa bài' : 'Xóa hết');

    const listHtml = !cur.words.length
      ? `<p class="module-sub">Danh sách này đang trống.</p>`
      : cur.words.map((w, i) => `
        <div class="imp-word-card">
          <div class="imp-grid-jp">
            <input class="inp m-inp" data-i="${i}" data-k="jp" value="${escapeHtml(w.jp)}">
            <input class="inp m-inp" data-i="${i}" data-k="reading" value="${escapeHtml(w.reading)}" placeholder="Cách đọc">
            <button type="button" class="btn btn-icon m-del imp-danger-txt" data-i="${i}" title="Xóa từ này">🗑</button>
          </div>
          <div class="imp-grid-vi">
            <input class="inp m-inp" data-i="${i}" data-k="vi" value="${escapeHtml(w.vi)}">
            <select class="inp m-inp" data-i="${i}" data-k="pos">${posOpts(w.pos)}</select>
          </div>
          <input class="inp m-inp" data-i="${i}" data-k="ex" value="${escapeHtml(w.ex)}" placeholder="Ví dụ">
          <input class="inp m-inp" data-i="${i}" data-k="exVi" value="${escapeHtml(w.exVi)}" placeholder="Nghĩa ví dụ">
        </div>`).join('');

    return `
      <div class="card col">
        <div class="row">
          <select id="m-target" class="inp grow">
            ${targets.map(t => `<option value="${escapeHtml(t.id)}" ${t.id === manageTarget ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
          ${showBulkBtn ? `<button type="button" id="m-bulk-del" class="btn ${confirmClear ? 'imp-danger-solid' : 'imp-danger-txt'}">${bulkLabel}</button>` : ''}
        </div>
        <div class="imp-scroll-list">${listHtml}</div>
        <div class="imp-backup-bar">
          <button type="button" id="m-export" class="btn grow">⬇ Xuất Backup</button>
          <label class="btn grow">⬆ Nhập Backup<input type="file" id="m-import" accept="application/json" hidden></label>
        </div>
      </div>`;
  }

  function mutateTargetWords(mutator) {
    if (manageTarget === 'user:weak') {
      const next = mutator(getWeak());
      clearWeak();
      next.forEach((w) => addWeak(w));
      return;
    }
    updateStore(STORE_KEY, (cur) => {
      if (manageTarget === 'user:open') return { ...cur, openWords: mutator([...(cur.openWords || [])]) };
      const customLessons = (cur.customLessons || []).map(l => l.id === manageTarget ? { ...l, words: mutator([...l.words]) } : l);
      return { ...cur, customLessons };
    });
  }

  function render() {
    const st = getVocabStore();
    container.innerHTML = `
      <div class="row-between mb-12">
        <button type="button" id="imp-back" class="btn">← Quay lại</button>
        <div class="module-title">Quản lý từ vựng</div>
      </div>
      <div class="mb-12 imp-tabs">
        <button type="button" class="btn ${tab === 'upload' ? 'btn-teal' : ''}" data-tab="upload">1. Tải file</button>
        <button type="button" class="btn ${tab === 'manual' ? 'btn-teal' : ''}" data-tab="manual">2. Nhập tay</button>
        <button type="button" class="btn ${tab === 'manage' ? 'btn-teal' : ''}" data-tab="manage">3. Kho từ</button>
      </div>
      ${msg ? `<div class="card imp-msg ${isErr ? 'is-error' : ''}">${escapeHtml(msg)}</div>` : ''}
      ${tab === 'upload' ? renderUpload() : tab === 'manual' ? renderManual(st) : renderManage(st)}
    `;

    container.querySelector('#imp-back').onclick = () => onBack && onBack();
    container.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; msg = ''; confirmClear = false; render(); });

    container.querySelector('#up-file')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const res = parseFileText(f.name, String(reader.result));
          preview = res.words; lessonName = res.name; conflictName = '';
          setStatus(`Đã đọc ${preview.length} từ. Sửa trực tiếp bên dưới trước khi lưu.`);
        } catch (err) { preview = []; setStatus(err.message, true); }
        render();
      };
      reader.readAsText(f);
    });

    container.querySelector('#up-name')?.addEventListener('input', (e) => { lessonName = e.target.value; conflictName = ''; });
    container.querySelectorAll('.p-inp').forEach(el => el.addEventListener('input', (e) => { preview[Number(e.target.dataset.i)][e.target.dataset.k] = e.target.value; }));
    container.querySelectorAll('.p-del').forEach(el => el.addEventListener('click', () => { preview.splice(Number(el.dataset.i), 1); render(); }));
    container.querySelector('#btn-save-up')?.addEventListener('click', () => saveUploaded('new'));
    container.querySelector('#btn-merge')?.addEventListener('click', () => saveUploaded('merge'));
    container.querySelector('#btn-replace')?.addEventListener('click', () => saveUploaded('replace'));

    container.querySelector('#form-manual')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const word = norm(Object.fromEntries(fd.entries()));
      const target = fd.get('target');
      updateStore(STORE_KEY, (cur) => {
        if (target === 'user:open') return { ...cur, openWords: [...(cur.openWords || []), word] };
        const customLessons = (cur.customLessons || []).map(l => l.id === target ? { ...l, words: [...l.words, word] } : l);
        return { ...cur, customLessons };
      });
      e.target.reset();
      setStatus(`Đã thêm "${word.jp}" thành công!`);
      render();
    });

    container.querySelector('#m-target')?.addEventListener('change', (e) => { manageTarget = e.target.value; msg = ''; confirmClear = false; render(); });
    container.querySelectorAll('.m-inp').forEach(el => el.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.i), key = e.target.dataset.k;
      mutateTargetWords(list => { if (list[idx]) list[idx] = norm({ ...list[idx], [key]: e.target.value }); return list; });
      setStatus('Đã tự động lưu thay đổi.');
    }));
    container.querySelectorAll('.m-del').forEach(el => el.addEventListener('click', () => {
      mutateTargetWords(list => (list.splice(Number(el.dataset.i), 1), list));
      setStatus('Đã xóa từ.'); render();
    }));
    container.querySelector('#m-bulk-del')?.addEventListener('click', () => {
      if (!confirmClear) { confirmClear = true; render(); return; }
      confirmClear = false;
      if (manageTarget === 'user:weak') clearWeak();
      else if (manageTarget === 'user:open') updateStore(STORE_KEY, cur => ({ ...cur, openWords: [] }));
      else {
        updateStore(STORE_KEY, cur => ({ ...cur, customLessons: (cur.customLessons || []).filter(l => l.id !== manageTarget) }));
        manageTarget = 'user:weak';
      }
      setStatus('Đã xóa xong!'); render();
    });
    container.querySelector('#m-export')?.addEventListener('click', () => { exportBackup(); setStatus('Đã tải file backup JSON!'); render(); });
    container.querySelector('#m-import')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try { await importBackup(f); setStatus('Khôi phục toàn bộ dữ liệu thành công!'); }
      catch (err) { setStatus(err.message, true); }
      render();
    });
  }

  render();
}