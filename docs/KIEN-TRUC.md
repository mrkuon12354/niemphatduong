# Kiến trúc app Niệm Phật Đường

Tài liệu này dành cho người mới học lập trình. Nó được cập nhật sau mỗi giai đoạn.
Hiện đã xong **Giai đoạn A** (khung app) và **B** (Niệm Phật, Thời khóa).

## 1. Cấu trúc thư mục

| File | Việc của nó |
|---|---|
| `index.html` | Trang duy nhất của app, gần như trống. JavaScript dựng giao diện vào đây. |
| `css/style.css` | Màu sắc, cỡ chữ, khoảng cách. |
| `js/config.js` | Cài đặt chung: tên app, phiên bản, `API_URL`, giá trị mặc định. |
| `js/strings.vi.js` | Toàn bộ chữ trên giao diện. Sửa lời ở đây. |
| `js/strings.js` | Chọn ngôn ngữ (hiện chỉ có tiếng Việt). |
| `js/storage.js` | Lớp lưu trữ. **Chỉ file này** được đọc/ghi dữ liệu trên máy. |
| `js/dates.js` | Hàm xử lý ngày giờ. |
| `js/ui.js` | Nút, thẻ, hộp hỏi, biểu tượng dùng chung. |
| `js/app.js` | Khởi động app và chuyển màn hình. |
| `js/today.js` | Màn hình Hôm nay. |
| `js/practice.js` | "Bộ máy" một thời niệm: đếm, tính giờ, lưu dần. Không vẽ giao diện. |
| `js/counter.js` | Vòng tròn đếm và màn hình Niệm Phật. Chỉ để niệm, không có cài đặt. |
| `js/schedule.js` | Màn hình Thời khóa. |
| `js/thapniem.js` | Trang Thập niệm pháp. |
| `js/sound.js` | Mõ, chuông, khánh, phát file ghi âm. |
| `js/microphone.js` | Mở micro, đo độ to của tiếng (không ghi âm). |
| `js/voice.js` | Từ độ to, đoán lúc có tiếng và đếm ra số câu. |
| `js/device.js` | Rung, giữ sáng màn hình. |
| `js/reminders.js` | Nhắc giờ thời khóa. |
| `js/controls.js` | Bộ nút chỉnh mõ, khánh, cách đếm, hẹn giờ. |
| `js/content.js` | Đọc nội dung từ các file JSON. |
| `js/verses.js` | Hiển thị bài kệ và nhãn CẦN THẨM ĐỊNH. |
| `content/verses.json` | Tán Phật kệ, Hồi hướng. |
| `content/practices.json` | Thập niệm pháp (bản nháp). |
| `audio/playlist.json` | Danh sách file ghi âm; cách thêm xem `audio/README.md`. |
| `js/calendar.js` | Màn hình Lịch (Giai đoạn C). |
| `js/lessons.js` | Màn hình Học (Giai đoạn D). |
| `js/settings.js` | Cài đặt: trang mục lục và bốn trang con. Mọi lựa chọn nằm ở đây. |
| `js/info.js` | Trang Giới thiệu và Chính sách riêng tư. |

Sẽ thêm ở giai đoạn sau: `content/holidays.json`, `quotes.json`, `lessons.json`,
`js/lunar.js` (âm lịch), `icons/`, `manifest.json`, `sw.js`.

Mỗi mục nội dung có `id`, `version`, `status` và `source`. Khi `status` là `"draft"`, app hiện nhãn
CẦN THẨM ĐỊNH. Thẩm định xong thì đổi thành `"reviewed"` và ghi nguồn vào `source`.

Chữ duy nhất nằm ngoài `strings.vi.js` là vài dòng trong `index.html` (tiêu đề, lời báo khi
JavaScript chưa chạy được), vì lúc đó app chưa đọc được file chữ.

## 2. App chạy như thế nào

1. Trình duyệt mở `index.html`, rồi nạp `js/app.js`.
2. `app.js` mở kho dữ liệu, đọc cài đặt, áp dụng cỡ chữ và màu nền.
3. `app.js` dựng thanh trên, thanh dưới, rồi nhìn địa chỉ (ví dụ `#/cai-dat`) để biết vẽ màn hình nào.
4. Mỗi màn hình là một hàm `render...(page, ctx)` (so với Python: một hàm nhận hai tham số).
   - `page`: khung trống để bỏ nội dung vào.
   - `ctx`: những thứ được dùng chung, như `ctx.getSettings()`.
   - Hàm có thể trả về một "hàm dọn dẹp", được gọi khi rời màn hình.

Muốn thêm một màn hình: viết hàm vẽ, thêm một dòng vào bảng `ROUTES` trong `app.js`.
Trang con thì thêm `parent`: thanh trên sẽ có nút quay lại.

Thanh trên và thanh dưới đứng yên, chỉ phần giữa (`<main>`) cuộn. Tiêu đề ở thanh trên được chép từ
thẻ `h1` của trang (hàm `pageTitle()`), nên trang nào cũng phải có `pageTitle()`.

Để giao diện đồng nhất: bo góc dùng `var(--radius)`, khoảng cách dùng `var(--gap)`, nút dùng
`button()`, dòng mở trang khác dùng `menuLink()`, lựa chọn dùng `choiceGroup()` hoặc `toggle()`.

## 3. Cấu trúc dữ liệu

`storage.js` thử ba kho theo thứ tự: IndexedDB, localStorage, rồi bộ nhớ tạm.
Các file khác không cần biết đang dùng kho nào.

| Kho | Chứa gì |
|---|---|
| `kv` | Bản ghi `meta` (`schemaVersion`, `deviceId`) và bản ghi `settings`. |
| `sessions` | Mỗi thời niệm là một bản ghi. |
| `lessonProgress` | Bài đã học (dùng từ Giai đoạn D). |

Một thời niệm:

```json
{
  "id": "mã uuid ngẫu nhiên",
  "deviceId": "mã máy ngẫu nhiên",
  "startedAt": "2026-11-25T05:30:00+07:00",
  "endedAt": "2026-11-25T05:45:00+07:00",
  "phrase": "nam-mo-a-di-da-phat",
  "count": 324,
  "durationSec": 900,
  "type": "free | morning | evening | thapniem",
  "createdAt": "2026-11-25T05:45:00+07:00",
  "updatedAt": "2026-11-25T05:45:00+07:00"
}
```

Thập niệm có thêm `slot` (lần nào trong ngày). Bản ghi bị bỏ có thêm `deletedAt`.
Kho `kv` còn có bản ghi `reminderLog`: lần nhắc giờ gần nhất.

Vài quy tắc:

- **Thời đang niệm được lưu dần** vào cùng một bản ghi (cùng `id`), nên máy tắt đột ngột cũng không mất.

- **Không lưu tổng số câu.** Tổng luôn cộng lại từ các thời niệm, nên gộp dữ liệu nhiều máy không bị cộng trùng.
- **Ngày của một thời niệm** là 10 ký tự đầu của `startedAt`, tức ngày tại nơi người dùng đã niệm.
- **Khôi phục là gộp**, không phải ghi đè: trùng `id` thì giữ bản có `updatedAt` mới hơn.
- **`deviceId`** không đi theo file sao lưu như là mã của máy mới; mỗi máy giữ mã riêng.
- Đổi cấu trúc dữ liệu: tăng `SCHEMA_VERSION` và thêm một bước vào `MIGRATIONS` trong `storage.js`.

## 4. Các cách đếm câu niệm

Cài đặt `countMode` có ba giá trị. Cách nào thì chạm vòng tròn vẫn cộng thêm một câu.

- `touch`: người dùng tự chạm.
- `woodfish`: cứ `beatsPerPhrase` tiếng mõ thì tính một câu. `woodfishOn` bật thì app gõ;
  tắt thì vòng tròn chính là cái mõ để người dùng gõ. Trên màn hình đây là hai lựa chọn riêng.
- `voice`: nghe micro. App chỉ đo độ to, không hiểu lời. Chưa đo nhịp thì mỗi hơi niệm tính một câu;
  đã đo nhịp (`voicePhraseMs`, riêng từng câu niệm) thì lấy độ dài hơi niệm chia cho độ dài một câu.
  Micro chỉ chạy trên `localhost` hoặc địa chỉ `https`.

Tốc độ mõ: `secondsPerPhrase` là số giây của một câu, `beatsPerPhrase` là số tiếng mõ trong câu đó.
Hai tiếng mõ cách nhau `secondsPerPhrase / beatsPerPhrase` giây.

`stopMode`: đủ giờ, đủ câu thì app tự kết thúc (`auto`) hay chỉ đánh chuông (`self`).

## 5. Các bước dự kiến khi lên bản online

1. Chọn máy chủ (Supabase hoặc Firebase), điền `API_URL` trong `config.js`.
2. Nới dòng `Content-Security-Policy` trong `index.html` cho đúng địa chỉ máy chủ đó.
   Hiện dòng này chặn mọi kết nối ra ngoài.
3. Quyết định nút "Xóa toàn bộ dữ liệu" có xóa cả trên máy chủ hay không. Hiện nút này xóa hẳn
   trên máy (bỏ tích thập niệm thì chỉ đánh dấu `deletedAt`).
4. Thêm lớp đồng bộ trong `storage.js`: gửi bản ghi mới, nhận bản ghi về, gộp theo `id` và `updatedAt`
   giống hàm `importAll()`.
5. Hỏi ý người dùng trước khi bật đồng bộ; cập nhật trang Chính sách riêng tư.
6. Phòng niệm Phật chung: thêm một màn hình mới, dùng kết nối thời gian thực của máy chủ.
7. Đóng gói bằng Capacitor: thư mục này là phần web; thay rung, thông báo, giữ sáng màn hình
   bằng plugin khi cần.
