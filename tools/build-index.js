// Chạy: node tools/build-index.js
// Quét data/vocab/<cấp>/bai*.json (n5, n4, n3...), kiểm tra, rồi tạo lại data/vocab/index.json
// File bai*.json nằm thẳng trong data/vocab (không có thư mục cấp) được coi là N4.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "data", "vocab");
const POS = ["verb", "noun", "adv", "adj", "other"];
const num = f => parseInt(f.match(/\d+/)[0]);
const isBai = f => /^bai\d+\.json$/.test(f);

// danh sách [cấp, tên file, đường dẫn tương đối so với data/vocab]
const items = [];
for (const f of fs.readdirSync(root)) {
  const p = path.join(root, f);
  if (fs.statSync(p).isDirectory()) {
    if (!/^n\d$/i.test(f)) continue;
    for (const g of fs.readdirSync(p).filter(isBai)) items.push({ level: f.toLowerCase(), file: g, rel: `${f}/${g}` });
  } else if (isBai(f)) items.push({ level: "n4", file: f, rel: f });
}
const order = { n5: 0, n4: 1, n3: 2, n2: 3, n1: 4 };
items.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9) || num(a.file) - num(b.file));

const lessons = []; let bad = 0;
for (const it of items) {
  const n = num(it.file);
  // n4 giữ id cũ "b26" để không mất dữ liệu đã lưu; các cấp khác dạng "n5-b1"
  const id = it.level === "n4" ? "b" + n : `${it.level}-b${n}`;
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(root, it.rel), "utf8")); }
  catch (e) { console.log(`❌ ${it.rel}: JSON lỗi cú pháp - ${e.message}`); bad++; continue; }
  const w = d.words || [];
  const probs = [];
  if (d.lesson?.id !== id) probs.push(`lesson.id phải là "${id}" (đang là "${d.lesson?.id}")`);
  if (d.count != null && d.count !== w.length) probs.push(`count=${d.count} nhưng có ${w.length} từ`);
  const seen = new Set();
  w.forEach((x, i) => {
    for (const k of ["jp", "reading", "vi", "ex", "exVi"])
      if (!x[k] || !String(x[k]).trim()) probs.push(`từ #${i + 1} (${x.jp || "?"}) thiếu "${k}"`);
    if (!POS.includes(x.pos)) probs.push(`từ #${i + 1} (${x.jp}) pos="${x.pos}" không hợp lệ`);
    if (seen.has(x.jp)) probs.push(`từ #${i + 1} trùng "${x.jp}"`);
    seen.add(x.jp);
    if (/\[[^\]]*$|^[^\[]*\]/.test(x.ex || "")) probs.push(`từ #${i + 1} (${x.jp}) ngoặc [] trong ex bị lệch`);
  });
  if (w.length < 15 || w.length > 60) probs.push(`số từ ${w.length} bất thường (bài thường 25-40)`);
  console.log(probs.length ? `⚠️  ${it.rel}: ${w.length} từ` : `✅ ${it.rel}: ${w.length} từ`);
  probs.forEach(p => console.log("     - " + p));
  lessons.push({ id, name: `Bài ${n} (${it.level.toUpperCase()})`, level: it.level.toUpperCase(), file: it.rel, count: w.length });
}
fs.writeFileSync(path.join(root, "index.json"), JSON.stringify({ lessons }, null, 1));
const have = new Set(items.filter(i => i.level === "n4").map(i => num(i.file)));
const missing = []; for (let i = 26; i <= 50; i++) if (!have.has(i)) missing.push(i);
console.log(`\nĐã ghi index.json: ${lessons.length} bài. N4 còn thiếu (26-50): ${missing.length ? missing.join(", ") : "không"}.`);
if (bad) console.log(`${bad} file lỗi cú pháp bị bỏ qua.`);