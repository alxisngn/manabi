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
  const secLabel = (t) => `<div style="font-size:0.78rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;">${t}</div>`;

  container.innerHTML = `
    <h1 class="page-title">Tôi</h1>

    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="card" style="display:flex;flex-direction:column;gap:10px;">
        ${secLabel('Ôn tập cá nhân')}

        <div style="padding:10px 12px;border-radius:14px;background:var(--bg-elevated);border:1.5px solid var(--border);display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-weight:800;font-size:0.98rem;">📌 Từ cần ôn lại</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">Tự lưu khi làm sai hoặc đánh dấu</div>
            </div>
            <span class="badge">${weakCount} từ</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button type="button" class="btn btn-coral" data-nav="${baseVocab}?view=study-weak" ${weakCount === 0 ? 'disabled' : ''} style="font-size:0.9rem;">▶ Ôn ngay</button>
            <button type="button" class="btn" data-nav="${baseVocab}?view=weak" style="font-size:0.9rem;">Xem / Xóa</button>
          </div>
        </div>

        <div style="padding:10px 12px;border-radius:14px;background:var(--bg-elevated);border:1.5px solid var(--border);display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-weight:800;font-size:0.98rem;">📖 Từ mở rộng</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">Từ vựng thêm ngoài giáo trình</div>
            </div>
            <span class="badge">${openCount} từ</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button type="button" class="btn btn-teal" data-nav="${baseVocab}?view=study-open" ${openCount === 0 ? 'disabled' : ''} style="font-size:0.9rem;">▶ Học ngay</button>
            <button type="button" class="btn" data-nav="${baseVocab}?view=open" style="font-size:0.9rem;">Xem / Sửa</button>
          </div>
        </div>
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:10px;">
        ${secLabel('Giọng đọc')}

        <div style="display:flex;flex-direction:column;gap:6px;">
          <label for="voice-select" style="font-weight:700;font-size:0.9rem;">Giọng tiếng Nhật</label>
          <select id="voice-select" style="width:100%;min-height:44px;padding:8px 12px;border-radius:12px;border:2px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:0.92rem;font-weight:700;">
            <option value="">Tự động (khuyên dùng)</option>
          </select>
          <div id="voice-empty-hint" hidden style="font-size:0.82rem;color:var(--coral);line-height:1.45;">
            Thiết bị chưa có giọng tiếng Nhật. Hãy mở Cài đặt thiết bị → Trợ năng / Ngôn ngữ & Nhập liệu (Chuyển văn bản thành giọng nói) để tải gói giọng tiếng Nhật.
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <label for="voice-rate" style="font-weight:700;font-size:0.9rem;">Tốc độ đọc</label>
            <span id="voice-rate-val" class="badge badge-ready">${formatRate(voiceCfg.rate)}</span>
          </div>
          <input type="range" id="voice-rate" min="0.6" max="1.2" step="0.05" value="${voiceCfg.rate}" style="width:100%;accent-color:var(--teal);cursor:pointer;">
        </div>

        <button type="button" id="btn-test-voice" class="btn btn-teal" style="width:100%;font-size:0.95rem;">🔊 Nghe thử</button>
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:10px;">
        ${secLabel('Kho từ & Sao lưu')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" class="btn btn-yellow" data-nav="${baseVocab}?view=add" style="font-size:0.92rem;">＋ Thêm từ</button>
          <button type="button" class="btn" data-nav="${baseVocab}?view=manage" style="font-size:0.92rem;">🗂 Kho từ (${customCount})</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" id="btn-export" class="btn" style="font-size:0.92rem;">⬇ Xuất backup</button>
          <label class="btn" style="font-size:0.92rem;">
            ⬆ Nhập backup
            <input type="file" id="input-import" accept="application/json" hidden>
          </label>
        </div>
        <p id="backup-msg" class="backup-msg" hidden></p>
      </div>

      <div class="card is-muted" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span style="font-weight:700;">☁️ Đăng nhập & đồng bộ</span>
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
    msgEl.style.color = isErr ? 'var(--red)' : 'var(--green)';
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
        nextMsg.style.color = 'var(--green)';
        nextMsg.textContent = 'Khôi phục dữ liệu thành công!';
      }
    } catch (err) {
      showMsg(err.message || 'File không hợp lệ', true);
    }
  };
}