import { getStore, exportBackup, importBackup } from '../core/store.js';
import { getLevel } from '../core/nav.js';
import { escapeHtml } from '../core/util.js';
import { speakJP, getJapaneseVoices, getVoiceSettings, setVoiceSettings } from '../core/tts.js';
import {
  getSyncKey,
  getSyncStatus,
  onSyncStatus,
  createSyncKey,
  setSyncKey,
  clearSyncKey,
  syncNow
} from '../core/sync.js';

const SAMPLE_TEXT = 'これは日本語のテストです。診ます、探します、間に合います。';
const formatRate = (r) => `${Number(r).toFixed(2).replace(/0$/, '')}x`;

function formatSyncTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 10) return '••••••••';
  return `${key.slice(0, 6)}••••••••••••••••${key.slice(-4)}`;
}

export function mount(container) {
  const st = getStore('vocab', { weakWords: [], openWords: [], customLessons: [] });
  const voiceCfg = getVoiceSettings();
  const weakCount = (st.weakWords || []).length;
  const openCount = (st.openWords || []).length;
  const customCount = (st.customLessons || []).length;
  const curLv = getLevel();
  const baseVocab = `#/${curLv.toLowerCase()}/vocab`;
  const secLabel = (t) => `<div class="me-sec-lbl">${t}</div>`;

  let showKey = false;
  let showKeyInput = false;
  let syncNote = '';
  let syncNoteErr = false;

  container.innerHTML = `
    <h1 class="page-title">Tôi</h1>

    <div class="col">
      <div class="card me-card">
        ${secLabel('Ôn tập cá nhân')}

        <div class="me-subbox">
          <div class="row-between">
            <div>
              <div class="me-item-title">📌 Từ cần ôn lại</div>
              <div class="me-item-sub">Tự lưu khi làm sai hoặc đánh dấu</div>
            </div>
            <span class="badge">${weakCount} từ</span>
          </div>
          <div class="grid-2">
            <button type="button" class="btn btn-coral text-base" data-nav="${baseVocab}?view=study-weak" ${weakCount === 0 ? 'disabled' : ''}>▶ Ôn ngay</button>
            <button type="button" class="btn text-base" data-nav="${baseVocab}?view=weak">Xem / Xóa</button>
          </div>
        </div>

        <div class="me-subbox">
          <div class="row-between">
            <div>
              <div class="me-item-title">📖 Từ mở rộng</div>
              <div class="me-item-sub">Từ vựng thêm ngoài giáo trình</div>
            </div>
            <span class="badge">${openCount} từ</span>
          </div>
          <div class="grid-2">
            <button type="button" class="btn btn-teal text-base" data-nav="${baseVocab}?view=study-open" ${openCount === 0 ? 'disabled' : ''}>▶ Học ngay</button>
            <button type="button" class="btn text-base" data-nav="${baseVocab}?view=open">Xem / Sửa</button>
          </div>
        </div>
      </div>

      <div class="card me-card">
        ${secLabel('Giọng đọc')}

        <div class="me-field">
          <label for="voice-select" class="text-base me-lbl">Giọng tiếng Nhật</label>
          <select id="voice-select" class="w-full me-select">
            <option value="">Tự động (khuyên dùng)</option>
          </select>
          <div id="voice-empty-hint" class="me-voice-hint" hidden>
            Thiết bị chưa có giọng tiếng Nhật. Hãy mở Cài đặt thiết bị → Trợ năng / Ngôn ngữ & Nhập liệu (Chuyển văn bản thành giọng nói) để tải gói giọng tiếng Nhật.
          </div>
        </div>

        <div class="me-field">
          <div class="row-between">
            <label for="voice-rate" class="text-base me-lbl">Tốc độ đọc</label>
            <span id="voice-rate-val" class="badge badge-ready">${formatRate(voiceCfg.rate)}</span>
          </div>
          <input type="range" id="voice-rate" class="w-full me-range" min="0.6" max="1.2" step="0.05" value="${voiceCfg.rate}">
        </div>

        <button type="button" id="btn-test-voice" class="btn btn-teal w-full me-test-btn">🔊 Nghe thử</button>
      </div>

      <div class="card me-card">
        ${secLabel('Kho từ & Sao lưu')}
        <div class="grid-2">
          <button type="button" class="btn btn-yellow me-btn-md" data-nav="${baseVocab}?view=add">＋ Thêm từ</button>
          <button type="button" class="btn me-btn-md" data-nav="${baseVocab}?view=manage">🗂 Kho từ (${customCount})</button>
        </div>
        <div class="grid-2">
          <button type="button" id="btn-export" class="btn me-btn-md">⬇ Xuất backup</button>
          <label class="btn me-btn-md">
            ⬆ Nhập backup
            <input type="file" id="input-import" accept="application/json" hidden>
          </label>
        </div>
        <p id="backup-msg" class="backup-msg" hidden></p>
      </div>

      <div class="card me-card" id="sync-card"></div>
    </div>
  `;

  const syncCardEl = container.querySelector('#sync-card');

  const renderSyncCard = () => {
    const key = getSyncKey();
    const stSync = getSyncStatus();

    if (!key) {
      syncCardEl.innerHTML = `
        <div class="row-between">
          ${secLabel('Đồng bộ giữa các thiết bị')}
          <span class="badge">Chưa bật</span>
        </div>
        <p class="me-item-sub">Lưu tiến độ từ vựng & bài học lên đám mây bằng mã đồng bộ riêng, không cần tài khoản.</p>
        <div class="grid-2">
          <button type="button" id="btn-sync-create" class="btn btn-teal me-btn-md">✨ Tạo mã mới</button>
          <button type="button" id="btn-sync-toggle-in" class="btn me-btn-md">🔑 Nhập mã có sẵn</button>
        </div>
        ${showKeyInput ? `
          <div class="me-sync-entry">
            <input type="text" id="input-sync-key" class="w-full me-sync-input" placeholder="Dán mã đồng bộ (24–128 ký tự)..." autocomplete="off" spellcheck="false">
            <div class="grid-2">
              <button type="button" id="btn-sync-save-key" class="btn btn-yellow me-btn-md">Lưu & Đồng bộ</button>
              <button type="button" id="btn-sync-cancel-in" class="btn me-btn-md">Hủy</button>
            </div>
          </div>
        ` : ''}
        ${syncNote ? `<p class="me-sync-note ${syncNoteErr ? 'is-error' : ''}">${escapeHtml(syncNote)}</p>` : ''}
      `;

      syncCardEl.querySelector('#btn-sync-create').onclick = () => {
        try {
          createSyncKey();
          showKey = true;
          showKeyInput = false;
          syncNote = 'Đã tạo mã đồng bộ mới. Hãy sao chép và lưu giữ cẩn thận!';
          syncNoteErr = false;
          renderSyncCard();
        } catch (err) {
          syncNote = err.message || 'Không thể tạo mã';
          syncNoteErr = true;
          renderSyncCard();
        }
      };

      syncCardEl.querySelector('#btn-sync-toggle-in').onclick = () => {
        showKeyInput = !showKeyInput;
        syncNote = '';
        syncNoteErr = false;
        renderSyncCard();
        if (showKeyInput) syncCardEl.querySelector('#input-sync-key')?.focus();
      };

      syncCardEl.querySelector('#btn-sync-cancel-in')?.addEventListener('click', () => {
        showKeyInput = false;
        syncNote = '';
        renderSyncCard();
      });

      syncCardEl.querySelector('#btn-sync-save-key')?.addEventListener('click', () => {
        const val = syncCardEl.querySelector('#input-sync-key')?.value || '';
        try {
          setSyncKey(val);
          showKeyInput = false;
          showKey = false;
          syncNote = '';
          syncNoteErr = false;
          renderSyncCard();
        } catch (err) {
          syncNote = err.message || 'Mã đồng bộ không hợp lệ';
          syncNoteErr = true;
          renderSyncCard();
        }
      });
      return;
    }

    let badgeCls = 'badge';
    let statusText = 'Sẵn sàng đồng bộ';
    if (stSync.state === 'syncing') {
      badgeCls = 'badge badge-ready';
      statusText = 'Đang đồng bộ…';
    } else if (stSync.state === 'ok') {
      badgeCls = 'badge st-done';
      const hhmm = formatSyncTime(stSync.lastSyncAt);
      statusText = hhmm ? `Đã đồng bộ lúc ${hhmm}` : 'Đã đồng bộ';
    } else if (stSync.state === 'offline') {
      badgeCls = 'badge st-learning';
      statusText = 'Offline — tự đồng bộ khi có mạng';
    } else if (stSync.state === 'error') {
      badgeCls = 'badge st-learning';
      statusText = 'Tạm gián đoạn — sẽ thử lại sau';
    }

    syncCardEl.innerHTML = `
      <div class="row-between">
        ${secLabel('Đồng bộ giữa các thiết bị')}
        <span class="${badgeCls}">${escapeHtml(statusText)}</span>
      </div>

      <div class="me-subbox">
        <div class="me-sync-key-box">${escapeHtml(showKey ? key : maskKey(key))}</div>
        <div class="grid-2">
          <button type="button" id="btn-sync-reveal" class="btn btn-sm">${showKey ? '🙈 Ẩn mã' : '👁 Hiện mã'}</button>
          <button type="button" id="btn-sync-copy" class="btn btn-sm btn-teal">📋 Sao chép</button>
        </div>
      </div>

      <p class="me-sync-warn">⚠️ Ai có mã này đều xem/sửa được tiến trình của bạn — giữ kín.</p>

      <div class="grid-2">
        <button type="button" id="btn-sync-now" class="btn btn-yellow me-btn-md" ${stSync.state === 'syncing' ? 'disabled' : ''}>🔄 Đồng bộ ngay</button>
        <button type="button" id="btn-sync-off" class="btn me-btn-md me-btn-danger">Tắt đồng bộ trên máy này</button>
      </div>
      ${syncNote ? `<p class="me-sync-note ${syncNoteErr ? 'is-error' : ''}">${escapeHtml(syncNote)}</p>` : ''}
    `;

    syncCardEl.querySelector('#btn-sync-reveal').onclick = () => {
      showKey = !showKey;
      renderSyncCard();
    };

    syncCardEl.querySelector('#btn-sync-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(key);
        syncNote = 'Đã sao chép mã đồng bộ vào bộ nhớ tạm!';
        syncNoteErr = false;
      } catch {
        showKey = true;
        syncNote = 'Không tự sao chép được — hãy bấm Hiện mã và copy thủ công.';
        syncNoteErr = true;
      }
      renderSyncCard();
    };

    syncCardEl.querySelector('#btn-sync-now').onclick = () => {
      syncNote = '';
      syncNow();
    };

    syncCardEl.querySelector('#btn-sync-off').onclick = () => {
      clearSyncKey();
      showKey = false;
      showKeyInput = false;
      syncNote = 'Đã tắt đồng bộ trên máy này (dữ liệu học vẫn được giữ nguyên).';
      syncNoteErr = false;
      renderSyncCard();
    };
  };

  renderSyncCard();
  const unsubSync = onSyncStatus(() => {
    if (!document.body.contains(container)) {
      unsubSync();
      return;
    }
    renderSyncCard();
  });

  const voiceSelect = container.querySelector('#voice-select');
  const emptyHint = container.querySelector('#voice-empty-hint');
  const rateInput = container.querySelector('#voice-rate');
  const rateValEl = container.querySelector('#voice-rate-val');

  const syncVoiceList = () => {
    const voices = getJapaneseVoices();
    const curURI = getVoiceSettings().voiceURI;
    const opts = [
      `<option value="">Tự động (khuyên dùng)</option>`,
      ...voices.map((v) => {
        const tag = v.localService ? 'cài sẵn' : 'qua mạng';
        const sel = v.voiceURI === curURI ? 'selected' : '';
        return `<option value="${escapeHtml(v.voiceURI)}" ${sel}>${escapeHtml(v.name)} (${tag})</option>`;
      })
    ];
    voiceSelect.innerHTML = opts.join('');
    emptyHint.hidden = voices.length > 0;
  };

  syncVoiceList();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      if (document.body.contains(container)) syncVoiceList();
    };
  }

  voiceSelect.onchange = () => {
    setVoiceSettings({ voiceURI: voiceSelect.value });
  };

  rateInput.oninput = () => {
    const nextRate = Number(rateInput.value);
    rateValEl.textContent = formatRate(nextRate);
    setVoiceSettings({ rate: nextRate });
  };

  container.querySelector('#btn-test-voice').onclick = () => {
    speakJP(SAMPLE_TEXT);
  };

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.onclick = () => { window.location.hash = btn.dataset.nav; };
  });

  const msgEl = container.querySelector('#backup-msg');
  const showMsg = (text, isErr = false) => {
    msgEl.hidden = false;
    msgEl.classList.toggle('is-error', isErr);
    msgEl.textContent = text;
  };

  container.querySelector('#btn-export').onclick = () => {
    exportBackup();
    showMsg('Đã tải file sao lưu về máy!');
  };

  container.querySelector('#input-import').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      mount(container);
      const nextMsg = container.querySelector('#backup-msg');
      if (nextMsg) {
        nextMsg.hidden = false;
        nextMsg.classList.remove('is-error');
        nextMsg.textContent = 'Khôi phục dữ liệu thành công!';
      }
    } catch (err) {
      showMsg(err.message || 'File không hợp lệ', true);
    }
  };
}