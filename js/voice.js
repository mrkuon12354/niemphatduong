// voice.js — Phần tính toán để đếm câu niệm bằng tai nghe của máy (micro).
// File này chỉ làm việc với con số, không đụng tới micro, nên dễ kiểm tra.
//
// Cách làm gồm hai bước:
//   1. Từ độ to của âm thanh, đoán lúc nào có tiếng người, lúc nào im lặng.
//   2. Từ các quãng có tiếng và im lặng, đếm ra số câu.
// App KHÔNG hiểu lời nói. Nói chuyện hay tiếng ồn lớn cũng có thể bị đếm.

// --------------------------------------------------------- Bước 1: có tiếng hay không

const WINDOW_SIZE = 200;   // Nhớ 200 mẫu gần nhất (khoảng 8 giây) để biết tiếng ồn nền
const WARM_UP_SIZE = 25;   // Khoảng 1 giây đầu chỉ nghe tiếng ồn nền
const QUIETEST_DB = -58;   // Nhỏ hơn mức này thì luôn coi là im lặng

// Phải to hơn tiếng ồn nền bao nhiêu decibel mới tính là có tiếng.
const ABOVE_NOISE_DB = { low: 16, medium: 11, high: 7 };

export function createVoiceDetector(sensitivity) {
  const above = ABOVE_NOISE_DB[sensitivity];
  const recent = [];
  let isVoice = false;

  return {
    get isReady() { return recent.length >= WARM_UP_SIZE; },

    // Nhận độ to (decibel) của một mẫu, trả về true nếu đang có tiếng.
    push(db) {
      recent.push(db);
      if (recent.length > WINDOW_SIZE) recent.shift();
      if (recent.length < WARM_UP_SIZE) return false;
      // Tiếng ồn nền: mức mà chỉ 1/10 số mẫu nhỏ hơn nó.
      const noise = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 10)];
      const threshold = Math.max(noise + above, QUIETEST_DB);
      // Đang có tiếng thì phải nhỏ hẳn đi mới coi là im, để không chập chờn.
      isVoice = db > (isVoice ? threshold - 4 : threshold);
      return isVoice;
    },
  };
}

// --------------------------------------------------------- Bước 2: đếm câu

const GAP_MS = 300;         // Im chừng này thì coi như dứt một hơi niệm
const FORGET_MS = 1500;     // Im chừng này thì bỏ phần câu còn dở
const MIN_PHRASE_MS = 350;  // Chưa đo nhịp: tiếng ngắn hơn chừng này thì bỏ qua

// phraseMs: một câu dài bao nhiêu mili giây; 0 = chưa đo (mỗi hơi tính một câu).
// onSpan(ms): báo độ dài mỗi hơi niệm, dùng khi đo nhịp.
export function createPhraseCounter({ phraseMs = 0, onCount = () => {}, onSpan = () => {} }) {
  let isActive = false; // Đang trong một hơi niệm
  let span = 0;         // Độ dài hơi niệm này
  let silence = 0;
  let carry = 0;        // Phần câu còn dở của hơi trước (ví dụ nghỉ sau "Nam Mô")
  let counted = 0;      // Số câu đã tính trong hơi này

  const emit = (total) => {
    for (; counted < total; counted += 1) onCount();
  };

  function closeSpan() {
    isActive = false;
    onSpan(span);
    if (phraseMs === 0) {
      if (span >= MIN_PHRASE_MS) onCount();
      return;
    }
    const phrases = (carry + span) / phraseMs;
    const total = Math.floor(phrases + 0.4); // Được từ 6/10 câu trở lên thì tính là một câu
    emit(total);
    carry = total === 0 ? carry + span : 0;
  }

  return {
    push(isVoice, ms) {
      if (isVoice) {
        if (!isActive) {
          isActive = true;
          span = 0;
          counted = 0;
          silence = 0;
        }
        span += silence + ms; // Quãng nghỉ rất ngắn vẫn thuộc cùng một hơi
        silence = 0;
        // Niệm liên tục không nghỉ: đủ dài một câu thì tính ngay.
        if (phraseMs > 0) emit(Math.floor((carry + span) / phraseMs));
        return;
      }
      silence += ms;
      if (isActive && silence >= GAP_MS) closeSpan();
      if (silence >= FORGET_MS) carry = 0;
    },

    // Dứt hơi niệm đang dở (dùng khi bấm "Xong" lúc đo nhịp).
    flush() {
      if (isActive) closeSpan();
    },
  };
}
