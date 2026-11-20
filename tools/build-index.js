// Chạy: node tools/build-index.js
// Cấu trúc dữ liệu:  data/<cấp>/<kỹ năng>/bai<số>.json   (vd data/n4/vocab/bai26.json)
// Script kiểm tra dữ liệu rồi tự tạo:
//   data/<cấp>/<kỹ năng>/index.json   danh sách bài của kỹ năng đó
//   data/curriculum.json              tổng hợp: cấp nào có kỹ năng nào, bao nhiêu bài/mục
//   data/files.json                   danh sách file dữ liệu (để service worker cache offline)
const fs = require("fs"), path = require("path");
const DATA = path.join(__dirname, "..", "data");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const SKILLS = ["vocab", "kanji", "grammar", "reading", "listening"];
const POS = ["verb", "noun", "adv", "adj", "other"];
const num = f => parseInt(f.match(/\d+/)[0]);
const isBai = f => /^bai\d+\.json$/.test(f);
const exists = p => fs.existsSync(p) && fs.statSync(p).isDirectory();
const write = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 1));

const curriculum = { levels: [] };
const allFiles = [];
let errors = 0, warns = 0;

for (const lv of LEVELS) {
  const lvDir = path.join(DATA, lv);
  if (!exists(lvDir)) continue;
  const entry = { id: lv.toUpperCase(), skills: {} };
  for (const sk of SKILLS) {
    const skDir = path.join(lvDir, sk);
    if (!exists(skDir)) continue;
    const files = fs.readdirSync(skDir).filter(isBai).sort((a, b) => num(a) - num(b));
    if (!files.length) continue;
    const lessons = []; let items = 0;
    for (const f of files) {
      const n = num(f), rel = `${lv}/${sk}/${f}`;
      // n4/vocab giữ id cũ "b26" để không mất dữ liệu đã lưu
      const id = lv === "n4" && sk === "vocab" ? "b" + n : `${lv}-${sk}-b${n}`;
      let d;
      try { d = JSON.parse(fs.readFileSync(path.join(skDir, f), "utf8")); }
      catch (e) { console.log(`❌ ${rel}: JSON lỗi cú pháp - ${e.message}`); errors++; continue; }
      const w = d.words || d.items || [];
      const probs = [];
      if (d.lesson?.id !== id) probs.push(`lesson.id phải là "${id}" (đang là "${d.lesson?.id}")`);
      if (d.count != null && d.count !== w.length) probs.push(`count=${d.count} nhưng có ${w.length} mục`);
      if (sk === "vocab") {
        const seen = new Set();
        w.forEach((x, i) => {
          for (const k of ["jp", "reading", "vi"])
            if (!x[k] || !String(x[k]).trim()) probs.push(`từ #${i + 1} (${x.jp || "?"}) thiếu "${k}"`);
          if (!POS.includes(x.pos)) probs.push(`từ #${i + 1} (${x.jp}) pos="${x.pos}" không hợp lệ`);
          if (seen.has(x.jp)) probs.push(`từ #${i + 1} trùng "${x.jp}"`);
          seen.add(x.jp);
          if (/\[[^\]]*$|^[^\[]*\]/.test(x.ex || "")) probs.push(`từ #${i + 1} (${x.jp}) ngoặc [] trong ex bị lệch`);
          if ((x.ex && !x.exVi) || (!x.ex && x.exVi)) probs.push(`từ #${i + 1} (${x.jp}) ex và exVi phải đi cùng nhau`);
        });
        if (w.length < 10 || w.length > 60) probs.push(`số từ ${w.length} bất thường`);
      }
      if (sk === "grammar") {
        w.forEach((x, i) => {
          if (!x.pattern || !x.vi) probs.push(`mẫu #${i + 1} thiếu "pattern" hoặc "vi"`);
        });
        const allEx = [...(d.exercises || []), ...(d.extraExercises || [])];
        if (!w.length && !allEx.length) probs.push(`bài ngữ pháp trống cả mẫu câu lẫn bài tập`);
      }
      const itemCount = w.length || (d.exercises || []).length;
      console.log(probs.length ? `⚠️  ${rel}: ${itemCount} mục` : `✅ ${rel}: ${itemCount} mục`);
      probs.forEach(p => console.log("     - " + p));
      if (probs.length) warns++;
      lessons.push({
        id,
        name: d.lesson?.name || `Bài ${n}`,
        file: f,
        count: itemCount,
        ...(d.lesson?.week ? { week: d.lesson.week, day: d.lesson.day } : {}),
        ...(d.lesson?.type ? { type: d.lesson.type } : {})
      });
      items += itemCount; allFiles.push(`data/${rel}`);
    }
    write(path.join(skDir, "index.json"), { level: entry.id, skill: sk, lessons });
    allFiles.push(`data/${lv}/${sk}/index.json`);
    entry.skills[sk] = { lessons: lessons.length, items };
  }
  if (Object.keys(entry.skills).length) curriculum.levels.push(entry);
}
write(path.join(DATA, "curriculum.json"), curriculum);
allFiles.push("data/curriculum.json");
write(path.join(DATA, "files.json"), { files: allFiles });

console.log("\n=== Tổng hợp ===");
curriculum.levels.forEach(l => Object.entries(l.skills).forEach(([k, v]) =>
  console.log(`${l.id} ${k}: ${v.lessons} bài, ${v.items} mục`)));
console.log(`${errors} file lỗi cú pháp, ${warns} file có cảnh báo.`);