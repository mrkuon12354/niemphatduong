// practice.js — "Bộ máy" của một thời niệm: đếm câu, tính giờ, lưu dần.
// File này không vẽ giao diện; counter.js và schedule.js dùng chung bộ máy này.
//
// Trạng thái: idle (chưa bắt đầu) -> running (đang niệm) <-> paused (tạm nghỉ)
//             -> finished (xong). discarded: bị bỏ do người dùng xóa dữ liệu.

import { BEADS_PER_ROUND } from './config.js';
import { toLocalIso } from './dates.js';
import { newId, saveSession, requestPersistence } from './storage.js';
import {
  unlockSound, playBell, playChime, playKnock, startWoodfish, stopWoodfish, setWoodfishBpm,
  playRecording, stopRecording,
} from './sound.js';
import { openMicrophone } from './microphone.js';
import { createPhraseCounter } from './voice.js';
import { vibrate, keepAwake } from './device.js';

const SAVE_EVERY_MS = 2000;    // Đang niệm thì lưu dần, cách nhau chừng này
const MIN_SECONDS_TO_SAVE = 60; // Chưa đếm câu nào thì phải niệm ít nhất 1 phút mới lưu
const BELL_LEAD_SEC = 2.5;     // Chờ chuông ngân rồi mới vào nhịp mõ

const KNOCK_MS = 250;          // Tiếng mõ, khánh, chuông kêu to trong chừng này
const CHIME_MS = 1500;
const BELL_MS = 4000;

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
  let isSaved = false;   // Đã ghi xuống máy lần nào chưa
  let beats = 0;         // Số tiếng mõ của câu đang đếm
  let closeMicrophone = null;
  let deafUntil = 0;     // Tạm không nghe micro tới lúc này, vì app đang kêu chuông/mõ/khánh
  let microphoneKey = ''; // Micro đang mở với các cài đặt nào

  const practice = {
    id,
    type,
    phrase,
    state: 'idle',
    count: 0,
    goalReached: false, // Đã đủ giờ hoặc đủ câu, đang đợi người dùng tự dừng
    micStatus: 'off',   // Xem openMicrophone(); 'voice' = đang nghe thấy tiếng
    get startedAt() { return startedAt; },
    get goalCount() { return goalCount; },

    elapsedSec() {
      const ms = activeMs + (practice.state === 'running' ? Math.max(0, Date.now() - resumedAt) : 0);
      return Math.floor(Math.min(ms / 1000, timeLimitSec()));
    },

    // Số giây còn lại, hoặc null nếu không hẹn giờ.
    remainingSec() {
      return goalSec === null ? null : Math.max(0, goalSec - practice.elapsedSec());
    },

    // Đặt lại hẹn giờ, tính từ lúc này. 0 = không hẹn giờ.
    setTimer(minutes) {
      goalSec = minutes > 0 ? practice.elapsedSec() + minutes * 60 : null;
      practice.goalReached = false;
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
        removeSettingsListener = ctx.onSettingsChange(sync);
        // Đang nghe micro thì không đánh chuông mở đầu, kẻo chuông bị nghe nhầm.
        if (!isListening()) playBell();
      }
      practice.state = 'running';
      resumedAt = Date.now();
      beats = 0;
      ticker = setInterval(tick, 500);
      sync(ctx.getSettings(), isFirst && !isListening() ? BELL_LEAD_SEC : 0.2);
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

    // Chạm để đếm một câu.
    tap() {
      if (practice.state === 'idle' || practice.state === 'paused') practice.start();
      if (practice.state !== 'running') return;
      addOne({ isTouch: true });
    },

    // Bớt một câu (khi app đếm nhầm hoặc lỡ chạm).
    undo() {
      if (practice.count === 0 || practice.state === 'finished') return;
      practice.count -= 1;
      saveTimer ??= setTimeout(save, SAVE_EVERY_MS);
      notify();
    },

    // Người dùng tự gõ một tiếng mõ.
    knock() {
      unlockSound();
      playKnock();
      deafFor(KNOCK_MS);
      if (ctx.getSettings().countMode !== 'woodfish') return;
      if (practice.state === 'idle' || practice.state === 'paused') practice.start();
      beat();
    },

    // Người dùng tự gõ khánh.
    chime() {
      unlockSound();
      playChime();
      deafFor(CHIME_MS);
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
    if (practice.remainingSec() === 0) reachGoal();
    else notify();
  }

  // Thời gian được tính tối đa (để máy ngủ quên không làm dài thêm thời niệm).
  function timeLimitSec() {
    const canGoOn = practice.goalReached || ctx.getSettings().stopMode === 'self';
    return goalSec === null || canGoOn ? Infinity : goalSec;
  }

  // Đủ giờ hoặc đủ số câu: kết thúc, hoặc chỉ đánh chuông một lần rồi để người dùng tự dừng.
  function reachGoal() {
    if (!practice.goalReached && ctx.getSettings().stopMode === 'auto') {
      practice.finish();
      return;
    }
    if (!practice.goalReached) {
      practice.goalReached = true;
      playBell();
      deafFor(BELL_MS);
    }
    notify();
  }

  function addOne({ isTouch = false } = {}) {
    if (practice.state !== 'running') return;
    practice.count += 1;
    // Tròn một tràng thì rung dài. Đang nghe micro thì không rung, vì micro nghe thấy tiếng rung.
    const isRound = practice.count % BEADS_PER_ROUND === 0;
    if (ctx.getSettings().vibrate && !isListening() && (isTouch || isRound)) {
      vibrate(isRound ? [60, 60, 120] : 20);
    }
    saveTimer ??= setTimeout(save, SAVE_EVERY_MS);
    if (goalCount !== null && practice.count >= goalCount) reachGoal();
    else notify();
  }

  // Một tiếng mõ vừa kêu (app gõ hoặc người dùng gõ).
  function beat() {
    const { countMode, beatsPerPhrase } = ctx.getSettings();
    if (countMode !== 'woodfish' || practice.state !== 'running') return;
    beats += 1;
    if (beats < beatsPerPhrase) return;
    beats = 0;
    addOne();
  }

  function stopClock() {
    activeMs += Math.max(0, Date.now() - resumedAt);
    activeMs = Math.min(activeMs, timeLimitSec() * 1000);
    clearInterval(ticker);
    stopWoodfish();
    stopListening();
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
    if (document.hidden) {
      save();
      stopListening(); // Không nghe micro khi người dùng không nhìn thấy app
      notify();
    } else if (practice.state === 'running') {
      unlockSound(); // Máy vừa thức dậy: tiếng có thể đã bị hệ thống ngắt, mở lại.
      syncMicrophone(ctx.getSettings());
    }
  }

  // Bật/tắt mõ và micro cho đúng với cài đặt.
  function sync(settings, delaySec = 0.2) {
    if (practice.state !== 'running') return;
    if (!settings.woodfishOn) {
      stopWoodfish();
    } else {
      startWoodfish(settings.woodfishBpm, delaySec, beat);
      setWoodfishBpm(settings.woodfishBpm);
    }
    syncMicrophone(settings);
  }

  function isListening() {
    return ctx.getSettings().countMode === 'voice';
  }

  function syncMicrophone(settings) {
    if (practice.state !== 'running') return;
    const phraseMs = settings.voicePhraseMs[practice.phrase] ?? 0;
    const key = isListening() && !document.hidden ? `${settings.voiceSensitivity}/${phraseMs}` : '';
    if (key === microphoneKey) return;
    stopListening();
    if (key === '') return;
    microphoneKey = key;
    const counter = createPhraseCounter({ phraseMs, onCount: addOne });
    const setStatus = (status) => {
      if (practice.micStatus === status) return;
      practice.micStatus = status;
      notify();
    };
    closeMicrophone = openMicrophone({
      sensitivity: settings.voiceSensitivity,
      onStatus: setStatus,
      onFrame: (isVoice, ms) => {
        if (Date.now() < deafUntil) return;
        counter.push(isVoice, ms);
        if (practice.state === 'running') setStatus(isVoice ? 'voice' : 'listening');
      },
    });
  }

  function deafFor(ms) {
    deafUntil = Math.max(deafUntil, Date.now() + ms);
  }

  function stopListening() {
    closeMicrophone?.();
    closeMicrophone = null;
    microphoneKey = '';
    practice.micStatus = 'off';
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const durationSec = practice.elapsedSec();
    if (!isSaved && practice.count === 0 && durationSec < MIN_SECONDS_TO_SAVE) return;
    isSaved = true;
    requestPersistence();
    saveSession({
      id, type, startedAt, endedAt: toLocalIso(),
      phrase: practice.phrase, count: practice.count, durationSec,
    }).catch(onSaveError);
  }

  return practice;
}
