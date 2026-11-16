import { getStore, exportBackup, importBackup } from '../core/store.js';
import { getLevel } from '../core/nav.js';
import { escapeHtml } from '../core/util.js';
import { speakJP, getJapaneseVoices, getVoiceSettings, setVoiceSettings } from '../core/tts.js';

const SAMPLE_TEXT = 'これは日本語のテストです。診ます、探します、間に合います。';
const formatRate = (r) => `${Number(r).toFixed(2).replace(/0$/, '')}x`;

export function mount(container) {
  const st = getStore('vocab', { weakWords: [], openWords: [], customLessons: [] });
  const voiceCfg = getVoiceSettings();
  const weakCount = (st.weakWords || []).length;
  const openCount = (st.openWords || []).length;
  const customCount = (st.customLessons || []).length;
  const curLv = getLevel();
  const baseVocab = `#/${curLv.toLowerCase()}/vocab`;
  const secLabel = (t) => `<div class="me-sec-lbl">${t}</div>`;

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

      <div class="card is-muted row-between me-sync-card">
        <span class="me-sync-lbl">☁️ Đăng nhập & đồng bộ</span>
        <span class="badge">Sắp có</span>
      </div>
    </div>
  `;

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