# Niệm Phật Đường

App tu học Pháp môn Tịnh độ dành cho người Việt. Miễn phí, không quảng cáo, không đăng nhập.

Trạng thái: xong **Giai đoạn C** (Niệm Phật, Thời khóa, âm lịch và Lịch tháng). Hướng dẫn cài lên điện thoại sẽ có ở Giai đoạn E.

## Chạy thử trên máy tính

1. Mở cửa sổ lệnh tại thư mục này.
2. Chạy lệnh:

   ```
   python -m http.server 8000
   ```

3. Mở trình duyệt, vào http://localhost:8000
4. Muốn dừng: bấm Ctrl + C trong cửa sổ lệnh.

Không mở bằng cách bấm đúp vào `index.html`: trình duyệt sẽ chặn JavaScript dạng module.

Sửa code xong mà không thấy thay đổi: bấm Ctrl + F5 để tải lại hoàn toàn.

## Đưa lên GitHub Pages để thử trên điện thoại

1. Tạo tài khoản và một repository trống, kiểu Public, tên `niem-phat-duong` trên https://github.com
2. Trong cửa sổ lệnh tại thư mục này (thay TEN-CUA-BAN bằng tên tài khoản):

   ```
   git remote add origin https://github.com/TEN-CUA-BAN/niem-phat-duong.git
   git push -u origin main
   ```

3. Trên trang repository: Settings → Pages → Source: Deploy from a branch → `main`, `/ (root)` → Save.
4. Vài phút sau, mở https://TEN-CUA-BAN.github.io/niem-phat-duong/

Lần sau sửa code xong: commit rồi chạy `git push`.

Cấu trúc code được giải thích trong `docs/KIEN-TRUC.md`.
