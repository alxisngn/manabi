# Manabi (学び) — Kế hoạch build, bắt đầu từ Từ vựng

Tên gợi ý: **Manabi** (học) — ngắn, dễ nhớ, mở rộng được sang Kanji/Ngữ pháp. Phương án khác: **Tsumiki** (xếp khối, hợp với việc build dần), **Kotoba Dojo**.
Link miễn phí: `manabi.pages.dev` (nếu trùng, Cloudflare sẽ bắt đổi tên project, chọn `manabi-<tên bạn>`). Domain riêng để sau.

## Quy trình làm việc với Gemini bản chat
Gemini chat không đọc được thư mục VSCode, nên:
1. Tạo **Gem** (Gems → New Gem), dán nội dung `GEM-instructions.md` làm Instructions. Chỉ làm 1 lần, về sau khỏi nhắc lại luật.
2. **1 phase = 1 chat mới** với Gem đó. Chat dài sẽ tốn token vì lượt nào cũng gửi lại toàn bộ lịch sử.
3. Chỉ dán những file mà phase đó cần sửa (thường 1–2 file). Gemini trả lại **toàn bộ file**, bạn dán đè vào VSCode (file nhỏ nên rẻ, đỡ lỗi ghép code).
4. Test bằng Live Server → `git commit` → `git push`. Cloudflare tự deploy.
5. Có lỗi: dán thông báo Console (F12) + file lỗi, mô tả hành vi sai. Đừng nói chung chung "sửa lỗi".

## PDF → JSON bằng Gemini chat: khả thi
Gemini đọc PDF theo dạng hình + chữ nên xử lý layout 2 cột có furigana tốt hơn việc trích text bằng code. Cách làm cho chắc:
- **Mỗi lần 1 bài** (hoặc 3–5 trang). Cả quyển trong một lần dễ bị cắt cụt hoặc bỏ sót.
- Dán kèm 2–3 từ mẫu từ `bai26.json` làm khuôn.
- Bắt nó ghi `count`, rồi **bạn đếm lại** với PDF.
- Soát nhanh furigana và nghĩa (nhất là từ ít gặp). AI có thể đọc sai cách đọc.
- App sẽ có màn hình xem trước và sửa, nên sai vài chỗ vẫn sửa được.

Prompt (kèm file PDF):
```
Đính kèm là PDF từ vựng Riki Nihongo. CHỈ xử lý "Bài 27". Convert TOÀN BỘ mục từ vựng sang JSON đúng cấu trúc mẫu dưới.
- pos: verb | noun | adv | adj | other
- reading: hiragana (katakana giữ nguyên)
- ex: câu ví dụ, furigana ghi dạng 漢字[かんじ]; exVi: nghĩa tiếng Việt của câu
- Sửa lỗi chính tả rõ ràng (vd "うしたら" -> "どうしたら"), giữ nguyên nghĩa tiếng Việt
- Không bỏ sót mục nào; cuối cùng thêm trường "count" = số từ
- Chỉ trả 1 code block JSON, không giải thích

Mẫu:
{"lesson":{"id":"b27","name":"Bài 27","type":"book"},"count":0,"words":[
{"jp":"診ます","reading":"みます","vi":"Xem, khám","pos":"verb","ex":"おなかが痛[いた]いですから、医者[いしゃ]に診[み]てもらいました。","exVi":"Vì đau bụng nên tôi đã đi khám bác sĩ."}]}
```
Lưu kết quả thành `data/vocab/bai27.json` rồi thêm một dòng vào `data/vocab/index.json`. Đẩy lên GitHub là bài đó có mặt trên mọi thiết bị.

Lưu ý về lưu trữ: bài **nhập tay / upload trong app** nằm trong localStorage, nên mỗi thiết bị (điện thoại, laptop) giữ bản riêng. Dùng Export/Import backup để chuyển qua lại. Bài chính thức của sách thì cho vào repo.

## Phase 0 — GitHub + Cloudflare (làm TRƯỚC, deploy sớm)
1. Tạo thư mục `manabi`, mở bằng VSCode, thêm `index.html` chỉ có "Hello Manabi".
2. Terminal: `git init` → `git add .` → `git commit -m "init"`. Tạo repo `manabi` trên GitHub (private cũng được), rồi `git remote add origin <url>` → `git branch -M main` → `git push -u origin main`.
3. Cloudflare Dashboard → **Workers & Pages** → Create → **Pages** → Connect to Git → chọn repo. Framework: None. Build command: để trống. Output directory: `/` (để trống nếu nó cho phép). Giao diện Cloudflare có thể đổi chút theo thời gian.
4. Mở link `*.pages.dev` trên điện thoại để chắc nó chạy. Từ đây mỗi lần `git push` là web tự cập nhật.
5. Thêm `README.md` ngắn và file `docs/PLAN.md` (file này) + `docs/GEM-instructions.md` vào repo.

## Phase 1 — Khung, theme, danh sách module
```
Tạo index.html, css/style.css, js/app.js, js/core/store.js, js/core/util.js theo kiến trúc trong instructions.
Home: logo "Manabi 学び", 3 card module: Từ vựng (hoạt động), Kanji và Ngữ pháp (hiện "Sắp có", không bấm được). Router hash đơn giản (#/vocab). Theme đúng mô tả.
```

## Phase 2 — Nạp dữ liệu + chọn bài
Dán: `app.js`, `store.js`, `data/vocab/index.json`, `bai26.json`.
```
Làm js/modules/vocab/picker.js: đọc data/vocab/index.json rồi fetch các bài, gộp với bài người dùng trong localStorage. Hiện danh sách checkbox (tên bài + số từ), "Chọn tất cả", tổng số từ đã chọn, nút "Bắt đầu". Chọn xong hiện menu 4 mode: Học từ mới / Ghép thẻ / Kiểm tra / Luyện phản xạ (mode chưa làm hiện "Sắp có"). Từ đã chọn được gộp, shuffle, lưu vào state để mode nào cũng dùng. Ghi nhớ bài đã chọn lần trước.
```

## Phase 3 — Flashcard
Dán: `picker.js`, `app.js`.
```
Làm js/core/ruby.js, js/core/tts.js, js/modules/vocab/flashcard.js.
Mặt trước: chữ Nhật lớn + nút Nghe. Bấm thẻ để lật: reading, nghĩa, ví dụ có ruby và nghĩa câu. Nút trước/sau, thanh tiến độ "2/47", nút bookmark (thêm vào từ yếu), vuốt trái/phải trên điện thoại.
```

## Phase 4 — Thêm từ vựng
Dán: `store.js`, `picker.js`.
```
Làm js/modules/vocab/importer.js, màn hình "Thêm từ vựng" 3 tab:
1) Upload JSON/CSV: đọc file, validate cấu trúc (báo lỗi rõ ràng nếu sai), hiện bảng xem trước CHO SỬA TRỰC TIẾP từng ô, rồi Lưu thành bài mới (hỏi tên; trùng tên thì hỏi gộp hay thay).
2) Nhập tay: form (từ, cách đọc, nghĩa, loại từ, ví dụ, nghĩa ví dụ) + dropdown "Thêm vào": "Bài mở (từ ngoài sách)" hoặc một bài có sẵn. Chưa có bài mở thì tự tạo.
3) Quản lý: sửa/xóa từ, xóa bài do người dùng tạo.
Thêm Export/Import backup toàn bộ localStorage ra file JSON.
```

## Phase 5 — Kiểm tra (quiz)
Dán: `picker.js`, `ruby.js`, `store.js`.
```
Làm js/modules/vocab/quiz.js. Ba dạng câu hỏi trộn ngẫu nhiên: trắc nghiệm 4 đáp án (đáp án nhiễu lấy từ bộ đã chọn), Đúng/Sai (thuật ngữ - nghĩa có khớp không), Nối cặp 6 cặp.
Chọn xong: đáp án đúng tô xanh lá, sai tô đỏ, hiện ngay khung giải thích (từ có ruby, reading, nghĩa, ví dụ có ruby + nghĩa) và nút "Tiếp". Chọn số câu (tối đa = số từ). Cuối bài: điểm + "Ôn lại câu sai"; câu sai tự vào từ yếu.
```

## Phase 6 — Ghép thẻ
```
Làm js/modules/vocab/match.js: lưới thẻ từ Nhật (nền navy) và nghĩa (nền vàng nâu) trộn lẫn. Chọn 1 từ rồi chọn nghĩa: đúng thì cả hai sáng xanh rồi biến mất, sai thì rung + đỏ ngắn. Có đồng hồ. Bộ lớn thì chia vòng 10 cặp.
```

## Phase 7 — Luyện phản xạ
```
Làm js/modules/vocab/reflex.js, 3 chế độ: Nghe hiểu (phát audio, chọn nghĩa trong 4 ô), Phát âm (SpeechRecognition ja-JP; trình duyệt không hỗ trợ thì ẩn và báo), Thử thách tốc độ (5 giây/câu, thanh đếm ngược, combo, điểm).
Không hiện giải thích dài, chỉ flash xanh/đỏ rồi sang câu tiếp.
```

## Phase 8 — PWA và hoàn thiện
```
Thêm manifest.webmanifest, icons, sw.js cache các file tĩnh. Cache name có phiên bản (const V = "v1") để khi push bản mới thì xóa cache cũ. Rà lại mọi màn hình ở 360px. Thêm phím tắt 1-4 trên máy tính.
```
Sau khi deploy: mở trên điện thoại → "Thêm vào màn hình chính".
Gotcha: nếu sau khi push mà điện thoại vẫn hiện bản cũ thì đó là service worker cache. Tăng `V` lên `v2`.

## Phase 9 (tùy chọn) — Nhập PDF ngay trong app
Chỉ làm nếu thấy quy trình Gemini chat → JSON phiền. Dùng pdf.js gom text theo toạ độ rồi cho xem trước/sửa. Kém chính xác hơn Gemini nên để cuối.

## Mở rộng sau này
- **Kanji**: tạo `js/modules/kanji/`, `data/kanji/`, đổi `meta` trong app.js từ "Sắp có" sang hoạt động. Dùng lại core/ (store, ruby, tts, util).
- **Ngữ pháp**: tương tự `js/modules/grammar/`. Mỗi module có key localStorage riêng `manabi:<module>`.
- Mỗi lần mở rộng = 1 chat mới + dán `app.js` và 1 module mẫu (ví dụ `flashcard.js`) để Gemini bám đúng phong cách.

## Checklist mỗi lần đẩy bản mới
- [ ] Chạy thử bằng Live Server, mở Console không có lỗi đỏ
- [ ] Thử trên điện thoại (qua link pages.dev)
- [ ] `git add . && git commit -m "phase X" && git push`
