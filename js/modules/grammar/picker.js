import { getSummary } from '../../core/progress.js';
import { parseRuby } from '../../core/ruby.js';
import { speakJP } from '../../core/tts.js';
import { escapeHtml } from '../../core/util.js';
import { CLUSTERS, loadPatternBank, normalizeQuery, mountDrill } from './drill.js';
import { getWrongGrammarIds } from './state.js';

export async function mount(container, { level, query }) {
  const lv = String(level || 'N4').toLowerCase();
  const baseHash = `#/${lv}/grammar`;
  container.innerHTML = `<div class="card"><p class="module-sub">Đang tải ngữ pháp...</p></div>`;

  let lessons = [];
  try {
    const res = await fetch(`data/${lv}/grammar/index.json`);
    if (res.ok) lessons = (await res.json())?.lessons || [];
  } catch {}

  const pickId = query?.get('lesson');
  if (pickId) {
    const found = lessons.find((l) => l.id === pickId);
    if (found) {
      const res = await fetch(`data/${lv}/grammar/${found.file}`);
      if (res.ok) {
        const data = await res.json();
        const mod = found.type === 'weekly_test' || data.lesson?.type === 'weekly_test'
          ? await import('./test.js')
          : await import('./lesson.js');
        mod.mount(container, { level: level.toUpperCase(), meta: found, data, backHash: baseHash });
        return;
      }
    }
  }

  const mode = query?.get('mode');
  const clusterId = query?.get('cluster');
  if (mode === 'mix' || mode === 'weak' || clusterId) {
    const bank = await loadPatternBank(level, lessons);
    const fromLesson = query?.get('from');
    const backHash = fromLesson ? `${baseHash}?lesson=${encodeURIComponent(fromLesson)}` : `${baseHash}?tab=practice`;

    if (mode === 'mix') {
      mountDrill(container, {
        level: level.toUpperCase(),
        title: 'Trộn ngẫu nhiên toàn bộ N4',
        subtitle: 'Xáo trộn câu hỏi và thứ tự đáp án từ toàn bộ kho bài tập',
        pool: bank.allExercises,
        limit: 10,
        backHash
      });
      return;
    }

    if (mode === 'weak') {
      const wrongSet = new Set(getWrongGrammarIds());
      const weakPool = bank.allExercises.filter((ex) => wrongSet.has(ex.id));
      mountDrill(container, {
        level: level.toUpperCase(),
        title: 'Ôn câu từng làm sai',
        subtitle: 'Làm đúng câu nào hệ thống sẽ tự gỡ khỏi danh sách cần ôn',
        pool: weakPool,
        limit: 0,
        backHash
      });
      return;
    }

    const cl = CLUSTERS.find((c) => c.id === clusterId);
    if (cl) {
      const clPool = cl.patIds.flatMap((pid) => bank.exByPat.get(pid) || []);
      mountDrill(container, {
        level: level.toUpperCase(),
        title: cl.title,
        subtitle: cl.desc,
        pool: clPool,
        limit: 10,
        backHash
      });
      return;
    }
  }

  let activeTab = query?.get('tab') === 'practice' ? 'practice' : 'weeks';
  let searchText = '';
  let bankData = null;

  const summary = getSummary(level, 'grammar', lessons);
  const statusMap = new Map(summary.items.map((it) => [it.lessonId, it]));

  function renderWeeksHtml() {
    const weeks = new Map();
    lessons.forEach((l) => {
      const w = l.week || 1;
      if (!weeks.has(w)) weeks.set(w, []);
      weeks.get(w).push(l);
    });

    return [...weeks.entries()].map(([wk, list]) => {
      const days = list.filter((l) => l.type !== 'weekly_test');
      const test = list.find((l) => l.type === 'weekly_test');
      const doneCnt = list.filter((l) => statusMap.get(l.id)?.status === 'done').length;

      const dayBtns = days.map((d) => {
        const st = statusMap.get(d.id)?.status || 'none';
        const cls = st === 'done' ? 'is-done' : st === 'learning' ? 'is-learning' : '';
        return `<button type="button" class="btn gr-day-btn ${cls}" data-open="${escapeHtml(d.id)}">
          <span class="gr-day-num">Ngày ${d.day || ''}</span>
          <span class="gr-day-cnt">${d.count} mẫu</span>
        </button>`;
      }).join('');

      const testRec = test ? statusMap.get(test.id) : null;
      const testBadge = testRec?.bestPct != null ? `${testRec.bestPct}/100đ` : '18 câu • 20p';
      const testHtml = test
        ? `<button type="button" class="btn btn-coral gr-test-btn" data-open="${escapeHtml(test.id)}">
            <span>📝 ${escapeHtml(test.name)}</span>
            <span class="badge">${testBadge}</span>
          </button>`
        : '';

      return `<article class="card gr-week-card">
        <div class="gr-top">
          <h2 class="modal-title">Tuần ${wk}</h2>
          <span class="badge ${doneCnt === list.length ? 'badge-ready' : ''}">${doneCnt}/${list.length} ngày</span>
        </div>
        <div class="gr-day-grid">${dayBtns}</div>
        ${testHtml}
      </article>`;
    }).join('');
  }

  function renderPracticeBody() {
    if (!bankData) return '<div class="card"><p class="module-sub">Đang nạp kho bài tập...</p></div>';
    const { raw, kana } = normalizeQuery(searchText);

    if (raw) {
      const matched = bankData.patterns.filter((p) => p.searchBlob.includes(raw) || (kana && p.searchBlob.includes(kana)));
      if (!matched.length) {
        return '<div class="card"><p class="module-sub">Không tìm thấy mẫu ngữ pháp khớp từ khóa.</p></div>';
      }
      return matched.map((p) => {
        const cl = CLUSTERS.find((c) => c.patIds.includes(p.id));
        const ex = p.examples?.[0];
        const exHtml = ex
          ? `<div class="gr-ex mt-8">
              <div class="gr-ex-row">
                <div class="gr-ex-jp jp">${parseRuby(ex.jp)}</div>
                <button type="button" class="btn btn-icon gr-spk" data-say="${escapeHtml(ex.jp)}">🔊</button>
              </div>
              <div class="gr-ex-vi">${escapeHtml(ex.vi)}</div>
            </div>`
          : '';
        return `<article class="card gr-pat">
          <div class="gr-q-meta">
            <span>${escapeHtml(p.lessonName)}</span>
            ${p.formation ? `<span class="gr-pat-form">${escapeHtml(p.formation)}</span>` : ''}
          </div>
          <div class="gr-pat-name jp">${parseRuby(p.pattern)}</div>
          <div class="gr-pat-vi">${escapeHtml(p.vi || '')}</div>
          ${exHtml}
          ${cl ? `<a href="${baseHash}?cluster=${encodeURIComponent(cl.id)}" class="btn btn-teal gr-drill-btn"><span>⚡ Luyện cụm: ${escapeHtml(cl.title)}</span><span>→</span></a>` : ''}
        </article>`;
      }).join('');
    }

    const wrongCnt = getWrongGrammarIds().length;
    const totalCnt = bankData.allExercises.length;
    const clustersHtml = CLUSTERS.map((cl) => {
      const cnt = cl.patIds.reduce((sum, pid) => sum + (bankData.exByPat.get(pid)?.length || 0), 0);
      return `<button type="button" class="card gr-pat-link" data-cluster-open="${escapeHtml(cl.id)}">
        <div class="gr-q-meta">
          <span class="gr-pat-vi">${escapeHtml(cl.title)}</span>
          <span class="badge badge-ready">${cnt} câu</span>
        </div>
        <div class="gr-cluster-tags">${escapeHtml(cl.desc)}</div>
      </button>`;
    }).join('');

    return `
      <div class="gr-mode-grid">
        <button type="button" id="gr-mix-btn" class="btn btn-teal gr-mode-btn">
          <span class="gr-mode-title">🎲 Trộn 10 câu</span>
          <span class="gr-mode-sub">Ngẫu nhiên từ ${totalCnt} câu</span>
        </button>
        <button type="button" id="gr-weak-btn" class="btn btn-coral gr-mode-btn" ${wrongCnt ? '' : 'disabled'}>
          <span class="gr-mode-title">🩹 Ôn câu sai (${wrongCnt})</span>
          <span class="gr-mode-sub">${wrongCnt ? 'Làm lại câu nhầm' : 'Chưa có câu sai'}</span>
        </button>
      </div>
      <div class="gr-sec-head"><h2 class="gr-sec-title">Cụm ngữ pháp dễ nhầm</h2></div>
      <div class="gr-ex-list">${clustersHtml}</div>
    `;
  }

  async function render() {
    if (activeTab === 'practice' && !bankData) {
      bankData = await loadPatternBank(level, lessons);
    }

    const bodyHtml = activeTab === 'weeks'
      ? (renderWeeksHtml() || '<div class="card"><p class="module-sub">Chưa có dữ liệu ngữ pháp.</p></div>')
      : `<div class="gr-search-box">
          <input type="text" id="gr-pat-search" class="inp gr-search-inp" value="${escapeHtml(searchText)}" placeholder="Tra nhanh mẫu câu (vd: toka, made, ばかり)..." autocomplete="off" />
          ${searchText ? '<button type="button" id="gr-pat-clear" class="btn gr-pill">✕</button>' : ''}
        </div>
        <div id="gr-pat-results" class="gr-ex-list">${renderPracticeBody()}</div>`;

    container.innerHTML = `
      <div class="gr-wrap">
        <div class="gr-top">
          <a href="#/learn" class="btn gr-pill">← Kỹ năng</a>
          <h1 class="gr-top-title">Ngữ pháp ${escapeHtml(level.toUpperCase())}</h1>
          <span class="badge">${summary.done}/${summary.total}</span>
        </div>

        <div class="gr-tabs">
          <button type="button" class="btn gr-tab ${activeTab === 'weeks' ? 'is-active' : ''}" data-tab="weeks">📅 Theo Tuần</button>
          <button type="button" class="btn gr-tab ${activeTab === 'practice' ? 'is-active' : ''}" data-tab="practice">⚡ Luyện tập</button>
        </div>

        ${bodyHtml}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.onclick = () => { activeTab = btn.dataset.tab; render(); };
    });

    container.querySelectorAll('[data-open]').forEach((btn) => {
      btn.onclick = () => { window.location.hash = `${baseHash}?lesson=${encodeURIComponent(btn.dataset.open)}`; };
    });

    const inp = container.querySelector('#gr-pat-search');
    if (inp) {
      inp.oninput = () => {
        searchText = inp.value;
        const listEl = container.querySelector('#gr-pat-results');
        if (listEl) listEl.innerHTML = renderPracticeBody();
        bindPracticeClicks();
      };
    }

    const clr = container.querySelector('#gr-pat-clear');
    if (clr) {
      clr.onclick = () => { searchText = ''; render(); container.querySelector('#gr-pat-search')?.focus(); };
    }

    bindPracticeClicks();
  }

  function bindPracticeClicks() {
    const mixBtn = container.querySelector('#gr-mix-btn');
    if (mixBtn) mixBtn.onclick = () => { window.location.hash = `${baseHash}?mode=mix`; };

    const weakBtn = container.querySelector('#gr-weak-btn');
    if (weakBtn) weakBtn.onclick = () => { window.location.hash = `${baseHash}?mode=weak`; };

    container.querySelectorAll('[data-cluster-open]').forEach((btn) => {
      btn.onclick = () => { window.location.hash = `${baseHash}?cluster=${encodeURIComponent(btn.dataset.clusterOpen)}`; };
    });

    container.querySelectorAll('[data-say]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); speakJP(b.dataset.say); };
    });
  }

  await render();
}