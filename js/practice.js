// practice.js — "Bộ máy" của một thời niệm: đếm câu, tính giờ, lưu dần.
// File này không vẽ giao diện; counter.js và schedule.js dùng chung bộ máy này.
//
// Trạng thái: idle (chưa bắt đầu) -> running (đang niệm) <-> paused (tạm nghỉ)
//             -> finished (xong). discarded: bị bỏ do người dùng xóa dữ liệu.

import { BEADS_PER_ROUND } from './config.js';
import { toLocalIso } from './dates.js';
import { newId, saveSession, requestPersistence } from './storage.js';
import {
  unlockSound, playBell, startWoodfish, stopWoodfish, setWoodfishBpm, playRecording, stopRecording,
} from './sound.js';
import { vibrate, keepAwake } from './device.js';

const SAVE_EVERY_MS = 2000;    // Đang niệm thì lưu dần, cách nhau chừng này
const MIN_SECONDS_TO_SAVE = 60; // Chưa đếm câu nào thì phải niệm ít nhất 1 phút mới lưu
const BELL_LEAD_SEC = 2.5;     // Chờ chuông ngân rồi mới vào nhịp mõ

const live = new Set(); // Các thời niệm chưa kết thúc

export function isPracticing() {
  return [...live].some((practice) => practice.state === 'running');
}

// Gọi sau khi xóa dữ liệu, để thời niệm đang dở không bị lưu trở lại.
export function discardAllPractices() {
  for (const practice of [...live]) practice.discard();
}

// goal: null | { kind: 'minutes' | 'count', value: số }
export function createPractice({ ctx, type, phrase, goal = null, onSaveError }) {
  const id = newId();
  const listeners = new Set();
  let startedAt = null;
  let activeMs = 0;      // Thời gian đã niệm, không tính lúc tạm nghỉ
  let resumedAt = 0;
  let goalSec = goal?.kind === 'minutes' ? goal.value * 60 : null;
  const goalCount = goal?.kind === 'count' ? goal.value : null;
  let recording = null;  // { url, onError } nếu có chọn file ghi âm
  let ticker = null;
  let saveTimer = null;
  let removeSettingsListener = null;

  const practice = {
    id,
    type,
    phrase,
    state: 'idle',
    count: 0,
    get startedAt() { return startedAt; },
    get goalCount() { return goalCount; },

    elapsedSec() {
      const ms = activeMs + (practice.state === 'running' ? Math.max(0, Date.now() - resumedAt) : 0);
      return Math.floor(goalSec === null ? ms / 1000 : Math.min(ms / 1000, goalSec));
    },

    // Số giây còn lại, hoặc null nếu không hẹn giờ.
    remainingSec() {
      return goalSec === null ? null : goalSec - practice.elapsedSec();
    },

    // Đặt lại hẹn giờ, tính từ lúc này. 0 = không hẹn giờ.
    setTimer(minutes) {
      goalSec = minutes > 0 ? practice.elapsedSec() + minutes * 60 : null;
      notify();
    },

    setRecording(value) {
      recording = value;
      if (practice.state !== 'running') return;
      stopRecording();
      if (recording) playRecording(recording.url, recording.onError);
    },

    setPhrase(value) {
      if (practice.state === 'idle') practice.phrase = value;
      notify();
    },

    // Bắt đầu hoặc niệm tiếp.
    start() {
      if (practice.state !== 'idle' && practice.state !== 'paused') return;
      const isFirst = practice.state === 'idle';
      unlockSound();
      if (isFirst) {
        startedAt = toLocalIso();
        live.add(practice);
        document.addEventListener('visibilitychange', onHidden);
        window.addEventListener('pagehide', save);
        removeSettingsListener = ctx.onSettingsChange(syncWoodfish);
        playBell();
      }
      practice.state = 'running';
      resumedAt = Date.now();
      ticker = setInterval(tick, 500);
      const settings = ctx.getSettings();
      if (settings.woodfishOn) startWoodfish(settings.woodfishBpm, isFirst ? BELL_LEAD_SEC : 0.2);
      if (recording) playRecording(recording.url, recording.onError);
      keepAwake(true);
      notify();
    },

    pause() {
      if (practice.state !== 'running') return;
      stopClock();
      practice.state = 'paused';
      save();
      notify();
    },

    // Đếm một câu.
    tap() {
      if (practice.state === 'idle' || practice.state === 'paused') practice.start();
      if (practice.state !== 'running') return;
      practice.count += 1;
      if (ctx.getSettings().vibrate) {
        // Tròn một tràng thì rung dài hơn.
        vibrate(practice.count % BEADS_PER_ROUND === 0 ? [60, 60, 120] : 20);
      }
      saveTimer ??= setTimeout(save, SAVE_EVERY_MS);
      notify();
      if (goalCount !== null && practice.count >= goalCount) practice.finish();
    },

    // silent: kết thúc mà không đánh chuông
    finish({ silent = false } = {}) {
      if (practice.state !== 'running' && practice.state !== 'paused') return;
      if (practice.state === 'running') stopClock();
      practice.state = 'finished';
      if (!silent) playBell();
      save();
      close();
      notify();
    },

    discard() {
      if (practice.state === 'running') stopClock();
      practice.state = 'discarded';
      close();
      notify();
    },

    // Nghe mỗi khi có thay đổi. Trả về hàm để thôi nghe.
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function notify() {
    for (const listener of [...listeners]) listener(practice);
  }

  function tick() {
    if (practice.remainingSec() === 0) practice.finish();
    else notify();
  }

  function stopClock() {
    activeMs += Math.max(0, Date.now() - resumedAt);
    if (goalSec !== null) activeMs = Math.min(activeMs, goalSec * 1000);
    clearInterval(ticker);
    stopWoodfish();
    stopRecording();
    keepAwake(false);
  }

  function close() {
    clearTimeout(saveTimer);
    saveTimer = null;
    live.delete(practice);
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', save);
    removeSettingsListener?.();
  }

  function onHidden() {
    if (document.hidden) save();
    // Máy vừa thức dậy: tiếng có thể đã bị hệ thống ngắt, mở lại.
    else if (practice.state === 'running') unlockSound();
  }

  function syncWoodfish(settings) {
    if (practice.state !== 'running') return;
    if (!settings.woodfishOn) {
      stopWoodfish();
    } else {
      startWoodfish(settings.woodfishBpm);
      setWoodfishBpm(settings.woodfishBpm);
    }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const durationSec = practice.elapsedSec();
    if (practice.count === 0 && durationSec < MIN_SECONDS_TO_SAVE) return;
    requestPersistence();
    saveSession({
      id, type, startedAt, endedAt: toLocalIso(),
      phrase: practice.phrase, count: practice.count, durationSec,
    }).catch(onSaveError);
  }

  return practice;
}
