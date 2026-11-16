// Chạy: node tools/check.js     (trước MỖI lần git commit)
// Bắt các lỗi hay gặp khi AI sửa code: sai cú pháp, import sai đường dẫn/tên, quên cập nhật service worker,
// dữ liệu JSON hỏng, file quá dài, dùng localStorage trực tiếp. Không cần cài thêm gì.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const rel = p => path.relative(ROOT, p).split(path.sep).join("/");
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);

function walk(dir, ext, out = []) {
  for (const f of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "data", "tools", "docs"].includes(f)) continue;
    const p = path.join(dir, f), s = fs.statSync(p);
    if (s.isDirectory()) walk(p, ext, out);
    else if (ext.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}
const jsFiles = walk(ROOT, [".js"]).filter(f => !rel(f).startsWith("tools/") && rel(f) !== "sw.js" || rel(f) === "sw.js");
const cssFiles = walk(ROOT, [".css"]);

// 1. Cú pháp
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: fs.readFileSync(f, "utf8"), encoding: "utf8" });
  if (r.status !== 0) err(`Cú pháp sai: ${rel(f)}\n      ${(r.stderr || "").split("\n").find(l => /SyntaxError/.test(l)) || r.stderr.slice(0, 200)}`);
}

// 2. Import: file tồn tại + tên import có được export không
const exportsOf = {};
function getExports(file) {
  if (exportsOf[file]) return exportsOf[file];
  const src = fs.readFileSync(file, "utf8"), set = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) set.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g))
    m[1].split(",").forEach(x => { const n = x.trim().split(/\s+as\s+/).pop(); if (n) set.add(n); });
  if (/export\s+default/.test(src)) set.add("default");
  return (exportsOf[file] = set);
}
for (const f of jsFiles) {
  if (rel(f) === "sw.js") continue;
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s+(?:([\s\S]*?)\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(f), m[2]);
    if (!fs.existsSync(target)) { err(`Import sai đường dẫn: ${rel(f)} → ${m[2]}`); continue; }
    const named = m[1] && m[1].match(/\{([^}]*)\}/);
    if (named) {
      const have = getExports(target);
      named[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => {
        if (!have.has(n)) err(`Import tên không tồn tại: ${rel(f)} import { ${n} } từ ${m[2]} (file đó không export ${n})`);
      });
    }
  }
  for (const m of src.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g))
    if (!fs.existsSync(path.resolve(path.dirname(f), m[1]))) err(`Dynamic import sai đường dẫn: ${rel(f)} → ${m[1]}`);
}

// 3. Service worker: file trong danh sách precache phải tồn tại; file code mới phải có trong danh sách
const swPath = path.join(ROOT, "sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");
  const listed = new Set([...sw.matchAll(/['"]\.\/([^'"]*)['"]/g)].map(m => m[1]).filter(x => x && !x.includes("*")));
  listed.forEach(x => { if (!fs.existsSync(path.join(ROOT, x))) err(`sw.js liệt kê file không tồn tại: ${x}`); });
  [...jsFiles, ...cssFiles].map(rel).filter(x => x !== "sw.js" && !x.startsWith("functions/")).forEach(x => {
    if (!listed.has(x)) warn(`sw.js chưa liệt kê ${x} (offline có thể thiếu file này)`);
  });
  const v = (sw.match(/const\s+V\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  console.log(`Service worker version: ${v || "?"}  (nhớ tăng khi sửa file mà điện thoại vẫn hiện bản cũ)`);
}

// 4. index.html: file được tham chiếu phải tồn tại
const html = path.join(ROOT, "index.html");
if (fs.existsSync(html)) {
  const h = fs.readFileSync(html, "utf8");
  for (const m of h.matchAll(/(?:src|href)=["']([^"':#]+\.(?:js|css|webmanifest|png|svg))["']/g))
    if (!fs.existsSync(path.join(ROOT, m[1]))) err(`index.html tham chiếu file không tồn tại: ${m[1]}`);
}
const mf = path.join(ROOT, "manifest.webmanifest");
if (fs.existsSync(mf)) {
  try { JSON.parse(fs.readFileSync(mf, "utf8")).icons.forEach(i => { if (!fs.existsSync(path.join(ROOT, i.src))) err(`manifest: icon không tồn tại ${i.src}`); }); }
  catch (e) { err("manifest.webmanifest lỗi: " + e.message); }
}

// 5. Dữ liệu JSON hợp lệ
(function checkData(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) checkData(p);
    else if (f.endsWith(".json")) { try { JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { err(`JSON hỏng: ${rel(p)} (${e.message})`); } }
  }
})(path.join(ROOT, "data"));

// 6. Quy ước: localStorage chỉ trong core/store.js (và nav.js); tránh history.replaceState; kích thước file
const LS_OK = new Set(["js/core/store.js", "js/core/nav.js", "js/core/sync.js"]);
for (const f of jsFiles) {
  const r = rel(f), src = fs.readFileSync(f, "utf8"), lines = src.split("\n").length;
  if (r !== "sw.js" && !LS_OK.has(r) && /localStorage\./.test(src)) warn(`${r}: dùng localStorage trực tiếp (nên đi qua core/store.js để đồng bộ/backup được)`);
  if (/history\.replaceState/.test(src) && !/replaceState\(\s*null\s*,\s*['"]['"]\s*,\s*location\.(pathname|href)/.test(src)) warn(`${r}: có history.replaceState (dễ làm hỏng nút Back)`);
  if (lines > 400) warn(`${r}: ${lines} dòng (quá dài, nên tách; mục tiêu < 300)`);
  const inl = (src.match(/style="/g) || []).length;
  if (inl > 15) warn(`${r}: ${inl} chỗ style="..." trong JS (nên chuyển thành class CSS)`);
}
for (const f of cssFiles) { const n = fs.readFileSync(f, "utf8").split("\n").length; if (n > 500) warn(`${rel(f)}: ${n} dòng CSS (nên tách theo khu vực)`); }
const junk = []; (function w(d) { for (const f of fs.readdirSync(d)) { if (f === ".git" || f === "node_modules") continue; const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (f === ".DS_Store") junk.push(rel(p)); } })(ROOT);
const gi = fs.existsSync(path.join(ROOT, ".gitignore")) ? fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8") : "";
if (junk.length && !/(^|\n)\.DS_Store\s*(\n|$)/.test(gi)) warn(`Có ${junk.length} file .DS_Store (thêm vào .gitignore)`);

// Kết quả
console.log("");
errors.forEach(e => console.log("❌ " + e));
warns.forEach(w => console.log("⚠️  " + w));
console.log(`\n${errors.length ? "❌ CÓ LỖI" : "✅ OK"}: ${errors.length} lỗi, ${warns.length} cảnh báo, ${jsFiles.length} file JS đã kiểm tra.`);
process.exit(errors.length ? 1 : 0);