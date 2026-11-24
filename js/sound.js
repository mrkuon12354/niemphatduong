// sound.js — Âm thanh: tiếng mõ, tiếng chuông (tự tạo bằng Web Audio API)
// và phát lặp lại file ghi âm niệm Phật.

let audio = null; // AudioContext: "dàn âm thanh" của trình duyệt

// Trình duyệt chỉ cho phát tiếng sau khi người dùng chạm hoặc bấm phím,
// nên hàm này phải được gọi ngay trong lúc xử lý cái chạm đó.
export function unlockSound() {
  if (!audio) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audio = new AudioContextClass();
      // iPhone: vẫn phát tiếng khi gạt nút im lặng (nếu Safari hỗ trợ).
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (error) {
      console.warn('Không dùng được âm thanh.', error);
      return;
    }
  }
  if (audio.state !== 'running') audio.resume()?.catch(() => {});
}

// ---------------------------------------------------------------------------
// Chuông: nhiều âm chồng lên nhau, ngân rồi tắt dần.
// ---------------------------------------------------------------------------

// Mỗi dòng: [tỉ lệ cao độ, độ to, số giây ngân]
const BELL_PARTIALS = [
  [0.5, 0.30, 7], [1, 0.45, 6], [1.19, 0.18, 5], [2.0, 0.22, 4], [2.74, 0.14, 2.8], [4.1, 0.07, 1.6],
];

export function playBell() {
  if (!audio) return;
  const start = audio.currentTime + 0.03;
  for (const [ratio, volume, seconds] of BELL_PARTIALS) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 330 * ratio;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * 0.5, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }
}

// ---------------------------------------------------------------------------
// Mõ: các tiếng gõ được hẹn trước theo đồng hồ của dàn âm thanh,
// nhờ vậy nhịp đều hơn nhiều so với dùng setInterval để gõ trực tiếp.
// ---------------------------------------------------------------------------

const LOOK_AHEAD_SEC = 1.3; // Hẹn trước chừng này giây
const woodfish = { timer: null, interval: 1, nextTime: 0, pending: [] };

function scheduleKnock(time) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(520, time);
  oscillator.frequency.exponentialRampToValueAtTime(290, time + 0.05);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.7, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.2);
  woodfish.pending.push({ time, gain });
}

function scheduleAhead() {
  const now = audio.currentTime;
  woodfish.pending = woodfish.pending.filter((knock) => knock.time > now - 1);
  // Máy bị chậm hoặc vừa ngủ dậy: bỏ qua các nhịp đã lỡ.
  if (woodfish.nextTime < now) woodfish.nextTime = now + 0.05;
  while (woodfish.nextTime < now + LOOK_AHEAD_SEC) {
    scheduleKnock(woodfish.nextTime);
    woodfish.nextTime += woodfish.interval;
  }
}

// Hủy các tiếng gõ đã hẹn mà chưa kêu. Trả về lúc của tiếng gõ cuối cùng đã kêu.
function cancelPending() {
  const now = audio.currentTime;
  let last = null;
  for (const knock of woodfish.pending) {
    if (knock.time > now) knock.gain.disconnect();
    else last = knock.time;
  }
  woodfish.pending = [];
  return last;
}

export function startWoodfish(bpm, delaySec = 0.2) {
  if (!audio || woodfish.timer) return;
  woodfish.interval = 60 / bpm;
  woodfish.nextTime = audio.currentTime + delaySec;
  woodfish.timer = setInterval(scheduleAhead, 200);
  scheduleAhead();
}

export function stopWoodfish() {
  if (!woodfish.timer) return;
  clearInterval(woodfish.timer);
  woodfish.timer = null;
  cancelPending();
}

export function setWoodfishBpm(bpm) {
  const interval = 60 / bpm;
  if (!woodfish.timer || interval === woodfish.interval) return;
  const firstPending = woodfish.pending.find((knock) => knock.time > audio.currentTime)?.time;
  const last = cancelPending();
  woodfish.interval = interval;
  // Nối nhịp mới từ tiếng gõ vừa rồi; chưa gõ tiếng nào thì giữ giờ bắt đầu cũ.
  woodfish.nextTime = last !== null
    ? Math.max(last + interval, audio.currentTime + 0.05)
    : firstPending ?? woodfish.nextTime;
  scheduleAhead();
}

// ---------------------------------------------------------------------------
// File ghi âm, phát lặp lại
// ---------------------------------------------------------------------------

let player = null;

export function playRecording(url, onError) {
  if (player?.dataset.url !== url) {
    stopRecording();
    player = new Audio(url);
    player.dataset.url = url;
    player.loop = true;
  }
  player.play().catch((error) => {
    if (error.name !== 'AbortError') onError(error);
  });
}

export function stopRecording() {
  player?.pause();
}
