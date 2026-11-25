// microphone.js — Nghe micro để đếm câu niệm.
// Âm thanh chỉ được đo độ to ngay trên máy: KHÔNG ghi âm, KHÔNG lưu, KHÔNG gửi đi đâu.

import { unlockSound, getAudioContext, setMicrophoneMode } from './sound.js';
import { createVoiceDetector } from './voice.js';

const FRAME_MS = 40;      // Đo độ to mỗi 40 mili giây
const MAX_FRAME_MS = 200; // Máy bị khựng lâu hơn thì không tính phần khựng

export function isMicrophoneSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

// Mở micro. Trả về hàm để đóng lại.
//   onFrame(isVoice, ms): gọi liên tục, cho biết có tiếng hay không
//   onStatus(status): 'starting' | 'warming' | 'listening'
//                     | 'missing' | 'busy' | 'denied' | 'unsupported' | 'failed'
// Máy chưa có micro ('missing') thì đợi; người dùng cắm micro vào là tự mở.
export function openMicrophone({ sensitivity, onFrame, onStatus }) {
  let isClosed = false;
  let stream = null;
  let source = null;
  let timer = null;

  function close() {
    if (isClosed) return;
    isClosed = true;
    clearInterval(timer);
    navigator.mediaDevices?.removeEventListener?.('devicechange', retry);
    source?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    setMicrophoneMode(false);
  }

  function fail(status) {
    if (isClosed) return;
    close();
    onStatus(status);
  }

  function start() {
    open().catch((error) => {
      console.error(error);
      fail('failed');
    });
  }

  function retry() {
    navigator.mediaDevices.removeEventListener('devicechange', retry);
    start();
  }

  function waitForDevice() {
    if (isClosed) return;
    setMicrophoneMode(false);
    onStatus('missing');
    navigator.mediaDevices.addEventListener?.('devicechange', retry);
  }

  async function open() {
    if (!isMicrophoneSupported()) return fail('unsupported');
    onStatus('starting');
    unlockSound();
    const audio = getAudioContext();
    if (!audio) return fail('unsupported');
    setMicrophoneMode(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
    } catch (error) {
      console.warn('Không mở được micro.', error);
      if (error.name === 'NotFoundError') return waitForDevice();
      return fail({ NotAllowedError: 'denied', NotReadableError: 'busy' }[error.name] ?? 'failed');
    }
    if (isClosed) { // Người dùng đã nghỉ niệm trong lúc chờ cho phép
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream.getAudioTracks()[0].addEventListener('ended', () => fail('failed'));

    // Chỉ giữ dải âm của giọng người, rồi đưa vào bộ đo. Không nối ra loa.
    source = audio.createMediaStreamSource(stream);
    const highpass = new BiquadFilterNode(audio, { type: 'highpass', frequency: 100 });
    const lowpass = new BiquadFilterNode(audio, { type: 'lowpass', frequency: 4000 });
    const analyser = new AnalyserNode(audio, { fftSize: 2048 });
    source.connect(highpass).connect(lowpass).connect(analyser);

    const detector = createVoiceDetector(sensitivity);
    const samples = new Float32Array(analyser.fftSize);
    let last = performance.now();
    let isListening = false;
    onStatus('warming');

    timer = setInterval(() => {
      const now = performance.now();
      const ms = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) sum += value * value;
      const db = 10 * Math.log10(sum / samples.length + 1e-10);
      const isVoice = detector.push(db);
      if (!detector.isReady) return;
      if (!isListening) {
        isListening = true;
        onStatus('listening');
      }
      onFrame(isVoice, ms);
    }, FRAME_MS);
  }

  start();
  return close;
}
