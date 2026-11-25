// sound.js — Âm thanh: tiếng mõ, chuông, khánh (tự tạo bằng Web Audio API)
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

export function getAudioContext() {
  return audio;
}

// iPhone: muốn dùng micro thì phải đổi sang chế độ vừa nghe vừa phát.
export function setMicrophoneMode(on) {
  if (navigator.audioSession) navigator.audioSession.type = on ? 'play-and-record' : 'playback';
}

// ---------------------------------------------------------------------------
// Chuông và khánh: nhiều âm chồng lên nhau, ngân rồi tắt dần.
// ---------------------------------------------------------------------------

// Mỗi dòng: [tỉ lệ cao độ, độ to, số giây ngân]
const BELL_PARTIALS = [
  [0.5, 0.30, 7], [1, 0.45, 6], [1.19, 0.18, 5], [2.0, 0.22, 4], [2.74, 0.14, 2.8], [4.1, 0.07, 1.6],
];
const CHIME_PARTIALS = [
  [1, 0.40, 2.6], [1.003, 0.20, 2.4], [2.71, 0.16, 1.3], [5.15, 0.07, 0.6],
];

export const playBell = () => playRing(330, BELL_PARTIALS, 0.03);
export const playChime = () => playRing(1250, CHIME_PARTIALS, 0);

function playRing(pitch, partials, delaySec) {
  if (!audio) return;
  const start = audio.currentTime + delaySec;
  for (const [ratio, volume, seconds] of partials) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = pitch * ratio;
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
const woodfish = { timer: null, interval: 1, nextTime: 0, pending: [], onBeat: null };

// Người dùng tự gõ một tiếng mõ.
export function playKnock() {
  if (audio) createKnock(audio.currentTime);
}

function createKnock(time) {
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
  return gain;
}

// Báo các tiếng mõ đã kêu kể từ lần xem trước (để đếm câu theo tiếng mõ).
function reportBeats() {
  const now = audio.currentTime;
  for (const knock of woodfish.pending) {
    if (knock.time > now || knock.isReported) continue;
    knock.isReported = true;
    woodfish.onBeat?.();
  }
}

function scheduleAhead() {
  reportBeats();
  if (!woodfish.timer) return; // Đủ số câu nên thời niệm vừa kết thúc
  const now = audio.currentTime;
  woodfish.pending = woodfish.pending.filter((knock) => knock.time > now - 1);
  // Máy bị chậm hoặc vừa ngủ dậy: bỏ qua các nhịp đã lỡ.
  if (woodfish.nextTime < now) woodfish.nextTime = now + 0.05;
  while (woodfish.nextTime < now + LOOK_AHEAD_SEC) {
    const gain = createKnock(woodfish.nextTime);
    woodfish.pending.push({ time: woodfish.nextTime, gain, isReported: false });
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

// onBeat: được gọi mỗi khi một tiếng mõ vừa kêu.
export function startWoodfish(bpm, delaySec, onBeat) {
  if (!audio || woodfish.timer) return;
  woodfish.interval = 60 / bpm;
  woodfish.nextTime = audio.currentTime + delaySec;
  woodfish.onBeat = onBeat;
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
  reportBeats();
  if (!woodfish.timer) return;
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
