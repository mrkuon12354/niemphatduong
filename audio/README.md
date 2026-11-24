# Thêm file ghi âm niệm Phật

Chỉ dùng file đã được phép sử dụng.

1. Chép file (ví dụ `niem-phat-1.mp3`) vào thư mục này.
2. Thêm vào `playlist.json`:

```json
{
  "items": [
    {
      "id": "niem-phat-1",
      "version": 1,
      "status": "reviewed",
      "source": "Ghi nguồn và người cho phép",
      "title": "Niệm Phật bốn chữ",
      "file": "niem-phat-1.mp3"
    }
  ]
}
```

Khi danh sách trống, hoặc file chưa có trong thư mục, app tự ẩn phần ghi âm.
Mục thứ hai trở đi cách mục trước bằng dấu phẩy.
