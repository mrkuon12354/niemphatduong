// config.js — Các cài đặt chung của app.
// Muốn đổi tên app, phiên bản, cỡ chữ cho phép... thì sửa ở đây.

export const APP_ID = 'niem-phat-duong'; // Mã nội bộ: đừng đổi, vì tên kho dữ liệu dựa vào đây.
export const APP_NAME = 'Niệm Phật Đường';
export const APP_VERSION = '0.1.0';

// Địa chỉ máy chủ. Để trống = app chạy hoàn toàn offline.
export const API_URL = '';

// Các nấc cỡ chữ (px). Nhỏ nhất là 18px cho người lớn tuổi.
export const FONT_STEPS = [18, 20, 22, 25, 28, 32];

export const THEMES = ['light', 'dark', 'auto'];

// Mã của câu niệm. Chữ hiển thị tương ứng nằm trong strings.vi.js.
export const PHRASES = ['nam-mo-a-di-da-phat', 'a-di-da-phat'];

// Tốc độ mõ: số tiếng mõ trong một phút.
export const WOODFISH_BPM = { min: 20, max: 160, step: 5 };

// Cài đặt ban đầu khi người dùng mở app lần đầu.
export const DEFAULT_SETTINGS = {
  fontSize: 20,
  theme: 'light',
  phrase: 'nam-mo-a-di-da-phat',
  woodfishBpm: 60,
  vibrate: true,
};

// Luật kiểm tra từng cài đặt: giá trị sai (ví dụ từ file sao lưu bị hỏng)
// sẽ bị thay bằng giá trị ban đầu, để app không bao giờ bị "kẹt".
export const SETTING_RULES = {
  fontSize: (v) => FONT_STEPS.includes(v),
  theme: (v) => THEMES.includes(v),
  phrase: (v) => PHRASES.includes(v),
  woodfishBpm: (v) =>
    Number.isInteger(v) && v >= WOODFISH_BPM.min && v <= WOODFISH_BPM.max,
  vibrate: (v) => typeof v === 'boolean',
};
