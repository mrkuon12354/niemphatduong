// config.js — Các cài đặt chung của app.
// Muốn đổi tên app, phiên bản, cỡ chữ cho phép... thì sửa ở đây.

export const APP_ID = 'niem-phat-duong'; // Mã nội bộ: đừng đổi, vì tên kho dữ liệu dựa vào đây.
export const APP_NAME = 'Niệm Phật Đường';
export const APP_VERSION = '0.2.2';

// Địa chỉ máy chủ. Để trống = app chạy hoàn toàn offline.
export const API_URL = '';

// Các nấc cỡ chữ (px). Nhỏ nhất là 18px cho người lớn tuổi.
export const FONT_STEPS = [18, 20, 22, 25, 28, 32];

export const THEMES = ['light', 'dark', 'auto'];

// Mã của câu niệm. Chữ hiển thị tương ứng nằm trong strings.vi.js.
export const PHRASES = ['nam-mo-a-di-da-phat', 'a-di-da-phat'];

// Tốc độ mõ: số tiếng mõ trong một phút.
export const WOODFISH_BPM = { min: 20, max: 160, step: 5 };

// Cách đếm: tự chạm, theo tiếng mõ, hoặc nghe tiếng niệm bằng micro.
export const COUNT_MODES = ['touch', 'woodfish', 'voice'];
// Đếm theo tiếng mõ: bao nhiêu tiếng mõ thì tính một câu.
export const BEATS_CHOICES = [1, 2, 4, 6];
export const VOICE_SENSITIVITIES = ['low', 'medium', 'high'];
// Đo nhịp niệm: niệm mẫu chừng này câu; độ dài một câu (mili giây) phải trong giới hạn.
export const VOICE_SAMPLE_PHRASES = 5;
export const VOICE_PHRASE_MS = { min: 300, max: 15000 };

// Số câu của một tràng hạt.
export const BEADS_PER_ROUND = 108;

// Hẹn giờ niệm: các lựa chọn có sẵn (phút) và giới hạn khi tự nhập.
export const TIMER_CHOICES = [5, 10, 15, 30];
export const MINUTES_LIMIT = { min: 1, max: 600 };
export const COUNT_LIMIT = { min: 1, max: 100000 };

// Cài đặt ban đầu khi người dùng mở app lần đầu.
export const DEFAULT_SETTINGS = {
  fontSize: 20,
  theme: 'light',
  phrase: 'nam-mo-a-di-da-phat',
  woodfishOn: true,       // App gõ mõ giữ nhịp
  handWoodfish: false,    // Hiện nút để tự gõ mõ
  handChime: false,       // Hiện nút để tự gõ khánh
  countMode: 'touch',
  beatsPerPhrase: 1,
  voiceSensitivity: 'medium',
  voicePhraseMs: {},      // Nhịp niệm đã đo: { mã câu niệm: mili giây }
  stopMode: 'auto',       // Đủ giờ, đủ câu: 'auto' = app kết thúc, 'self' = chỉ đánh chuông
  woodfishBpm: 60,
  vibrate: true,
  timerMinutes: 0,        // 0 = không hẹn giờ
  recordingId: '',        // '' = không phát ghi âm
  goalKind: 'minutes',    // Thời khóa: theo 'minutes' (phút), 'count' (số câu), 'free' (tự dừng)
  goalMinutes: 10,
  goalCount: 108,
  remindMorningOn: false,
  remindMorningTime: '05:30',
  remindEveningOn: false,
  remindEveningTime: '19:30',
};

const isBoolean = (v) => typeof v === 'boolean';
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isWithin = (v, { min, max }) => Number.isInteger(v) && v >= min && v <= max;

// Luật kiểm tra từng cài đặt: giá trị sai (ví dụ từ file sao lưu bị hỏng)
// sẽ bị thay bằng giá trị ban đầu, để app không bao giờ bị "kẹt".
export const SETTING_RULES = {
  fontSize: (v) => FONT_STEPS.includes(v),
  theme: (v) => THEMES.includes(v),
  phrase: (v) => PHRASES.includes(v),
  woodfishOn: isBoolean,
  handWoodfish: isBoolean,
  handChime: isBoolean,
  countMode: (v) => COUNT_MODES.includes(v),
  beatsPerPhrase: (v) => BEATS_CHOICES.includes(v),
  voiceSensitivity: (v) => VOICE_SENSITIVITIES.includes(v),
  voicePhraseMs: (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
    && Object.entries(v).every(([phrase, ms]) => PHRASES.includes(phrase) && isWithin(ms, VOICE_PHRASE_MS)),
  stopMode: (v) => v === 'auto' || v === 'self',
  woodfishBpm: (v) => isWithin(v, WOODFISH_BPM),
  vibrate: isBoolean,
  timerMinutes: (v) => v === 0 || isWithin(v, MINUTES_LIMIT),
  recordingId: (v) => typeof v === 'string',
  goalKind: (v) => ['minutes', 'count', 'free'].includes(v),
  goalMinutes: (v) => isWithin(v, MINUTES_LIMIT),
  goalCount: (v) => isWithin(v, COUNT_LIMIT),
  remindMorningOn: isBoolean,
  remindMorningTime: isTime,
  remindEveningOn: isBoolean,
  remindEveningTime: isTime,
};
