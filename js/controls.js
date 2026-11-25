// controls.js — Các bộ nút chỉnh cài đặt dùng ở nhiều màn hình.
// Mỗi hàm trả về { node, cleanup }: phần tử để hiện, và hàm dọn dẹp khi rời màn hình.

import {
  WOODFISH_BPM, TIMER_CHOICES, MINUTES_LIMIT, COUNT_MODES, BEATS_CHOICES,
  VOICE_SENSITIVITIES, VOICE_SAMPLE_PHRASES, VOICE_PHRASE_MS,
} from './config.js';
import { S } from './strings.js';
import { openMicrophone } from './microphone.js';
import { createPhraseCounter } from './voice.js';
import { el, button, toggle, choiceGroup, numberField, toast } from './ui.js';

// Mõ (app gõ, tự gõ, không dùng), tốc độ mõ, và nút tự gõ khánh
export function woodfishControl(ctx) {
  const T = S.settings;
  const value = el('p', { class: 'setting-value', 'aria-live': 'polite' });
  const step = (label, direction) => button(label, {
    onclick: () => {
      const next = ctx.getSettings().woodfishBpm + direction * WOODFISH_BPM.step;
      ctx.updateSettings({
        woodfishBpm: Math.min(WOODFISH_BPM.max, Math.max(WOODFISH_BPM.min, next)),
      });
    },
  });
  const slower = step(T.woodfishSlower, -1);
  const faster = step(T.woodfishFaster, 1);
  const speed = el('div', { class: 'stack' }, value, el('div', { class: 'row' }, slower, faster));

  const modeOf = (settings) => {
    if (settings.woodfishOn) return 'auto';
    return settings.handWoodfish ? 'hand' : 'off';
  };
  const modes = choiceGroup({
    name: 'woodfish', label: T.woodfishModeTitle, value: modeOf(ctx.getSettings()),
    options: ['auto', 'hand', 'off'].map((mode) => ({ value: mode, label: T.woodfishModes[mode] })),
    onchange: (mode) => {
      const patch = { woodfishOn: mode === 'auto', handWoodfish: mode === 'hand' };
      // Không dùng mõ thì không đếm theo tiếng mõ được nữa.
      if (mode === 'off' && ctx.getSettings().countMode === 'woodfish') patch.countMode = 'touch';
      ctx.updateSettings(patch);
    },
  });

  const update = (settings) => {
    modes.setValue(modeOf(settings));
    speed.hidden = !settings.woodfishOn;
    value.textContent = T.woodfishValue(settings.woodfishBpm);
    slower.disabled = settings.woodfishBpm <= WOODFISH_BPM.min;
    faster.disabled = settings.woodfishBpm >= WOODFISH_BPM.max;
  };
  update(ctx.getSettings());

  return {
    node: el('div', { class: 'stack' },
      modes,
      speed,
      toggle({
        label: T.chimeLabel, checked: ctx.getSettings().handChime,
        onchange: (handChime) => ctx.updateSettings({ handChime }),
      })),
    cleanup: ctx.onSettingsChange(update),
  };
}

// Cách đếm: tự chạm, theo tiếng mõ, hoặc nghe tiếng niệm
export function countControl(ctx, practice) {
  const T = S.counter;

  const modes = choiceGroup({
    name: 'count-mode', label: T.countTitle, value: ctx.getSettings().countMode,
    options: COUNT_MODES.map((value) => ({ value, label: T.countModes[value] })),
    onchange: (countMode) => {
      const { woodfishOn, handWoodfish } = ctx.getSettings();
      const patch = { countMode };
      if (countMode === 'woodfish' && !woodfishOn && !handWoodfish) patch.woodfishOn = true;
      if (countMode === 'voice') patch.woodfishOn = false; // Kẻo micro nghe nhầm tiếng mõ
      ctx.updateSettings(patch);
    },
  });

  const beats = el('div', { class: 'stack' },
    el('p', {}, T.beatsTitle),
    choiceGroup({
      name: 'beats', label: T.beatsTitle, inline: true,
      value: String(ctx.getSettings().beatsPerPhrase),
      options: BEATS_CHOICES.map((n) => ({ value: String(n), label: T.beats(n) })),
      onchange: (n) => ctx.updateSettings({ beatsPerPhrase: Number(n) }),
    }));

  // --- Đo nhịp: nghe người dùng niệm mẫu vài câu rồi chia ra độ dài một câu
  let measuring = null; // { close, counter, totalMs }
  const tempo = el('p', { class: 'setting-value', 'aria-live': 'polite' });
  const guide = el('p', { 'aria-live': 'polite' });

  const saveTempo = (ms) => {
    const { [practice.phrase]: old, ...others } = ctx.getSettings().voicePhraseMs;
    ctx.updateSettings({ voicePhraseMs: ms ? { ...others, [practice.phrase]: ms } : others });
  };
  const stopMeasuring = () => {
    measuring?.close();
    measuring = null;
    update();
  };
  const startMeasuring = () => {
    practice.pause();
    const current = { totalMs: 0, status: 'starting' };
    measuring = current;
    current.counter = createPhraseCounter({ onSpan: (ms) => { current.totalMs += ms; } });
    current.close = openMicrophone({
      sensitivity: ctx.getSettings().voiceSensitivity,
      onFrame: (isVoice, ms) => current.counter.push(isVoice, ms),
      onStatus: (status) => {
        current.status = status;
        update();
      },
    });
    update();
  };
  const finishMeasuring = () => {
    measuring.counter.flush();
    const ms = Math.round(measuring.totalMs / VOICE_SAMPLE_PHRASES);
    if (ms >= VOICE_PHRASE_MS.min && ms <= VOICE_PHRASE_MS.max) saveTempo(ms);
    else toast(T.tempoFailed);
    stopMeasuring();
  };

  const measure = button(T.tempoMeasure, { onclick: startMeasuring });
  const forget = button(T.tempoForget, { onclick: () => saveTempo(0) });
  const done = button(T.tempoDone, { variant: 'primary', onclick: finishMeasuring });
  const cancel = button(S.common.abort, { onclick: stopMeasuring });

  const voice = el('div', { class: 'stack' },
    T.voiceNotes.map((text) => el('p', {}, text)),
    el('p', {}, T.sensitivityTitle),
    choiceGroup({
      name: 'sensitivity', label: T.sensitivityTitle, inline: true,
      value: ctx.getSettings().voiceSensitivity,
      options: VOICE_SENSITIVITIES.map((value) => ({ value, label: T.sensitivities[value] })),
      onchange: (voiceSensitivity) => {
        if (measuring) stopMeasuring();
        ctx.updateSettings({ voiceSensitivity });
      },
    }),
    tempo, guide, measure, forget, done, cancel);

  function update() {
    const settings = ctx.getSettings();
    modes.setValue(settings.countMode);
    beats.hidden = settings.countMode !== 'woodfish';
    voice.hidden = settings.countMode !== 'voice';

    const ms = settings.voicePhraseMs[practice.phrase];
    const status = measuring?.status;
    const isReady = status === 'listening';
    tempo.textContent = ms
      ? T.tempoKnown((ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }))
      : T.tempoUnknown;
    tempo.hidden = Boolean(measuring);
    guide.hidden = !measuring;
    if (measuring) {
      guide.textContent = isReady
        ? T.tempoGuide(S.phrases[practice.phrase], VOICE_SAMPLE_PHRASES)
        : T.micStatus[status];
    }
    measure.hidden = Boolean(measuring);
    forget.hidden = Boolean(measuring) || !ms;
    done.hidden = !isReady;
    cancel.hidden = !measuring;
  }
  update();

  const removeSettingsListener = ctx.onSettingsChange(() => {
    if (measuring && ctx.getSettings().countMode !== 'voice') stopMeasuring();
    else update();
  });
  // Chuyển sang app khác: tắt micro.
  const onHidden = () => { if (document.hidden && measuring) stopMeasuring(); };
  document.addEventListener('visibilitychange', onHidden);
  // Đổi câu niệm, hoặc bắt đầu niệm khi đang đo: thôi đo.
  let phrase = practice.phrase;
  const removePracticeListener = practice.onChange(() => {
    if (measuring && (practice.state === 'running' || practice.phrase !== phrase)) stopMeasuring();
    else if (practice.phrase !== phrase) update();
    phrase = practice.phrase;
  });

  return {
    node: el('div', { class: 'stack' }, modes, beats, voice),
    cleanup() {
      removeSettingsListener();
      removePracticeListener();
      document.removeEventListener('visibilitychange', onHidden);
      if (measuring) stopMeasuring();
    },
  };
}

// Khi đủ giờ hoặc đủ câu: app kết thúc, hay để người dùng tự dừng
export function stopControl(ctx) {
  const T = S.counter;
  return el('div', { class: 'stack' },
    el('p', {}, T.stopTitle),
    choiceGroup({
      name: 'stop-mode', label: T.stopTitle, value: ctx.getSettings().stopMode,
      options: ['auto', 'self'].map((value) => ({ value, label: T.stopModes[value] })),
      onchange: (stopMode) => ctx.updateSettings({ stopMode }),
    }));
}

// Hẹn giờ niệm: các lựa chọn có sẵn hoặc tự nhập số phút
export function timerControl(ctx, onMinutes) {
  const T = S.counter;
  const current = ctx.getSettings().timerMinutes;
  const isCustom = current !== 0 && !TIMER_CHOICES.includes(current);

  const stop = stopControl(ctx);
  stop.hidden = current === 0;
  const choose = (minutes) => {
    stop.hidden = minutes === 0;
    ctx.updateSettings({ timerMinutes: minutes });
    onMinutes(minutes);
  };
  const custom = numberField({
    label: T.timerCustomLabel, value: isCustom ? current : 20, ...MINUTES_LIMIT,
    onchange: choose,
  });
  custom.hidden = !isCustom;

  const group = choiceGroup({
    name: 'timer', label: T.timerTitle, inline: true,
    value: isCustom ? 'custom' : String(current),
    options: [
      { value: '0', label: T.timerNone },
      ...TIMER_CHOICES.map((n) => ({ value: String(n), label: T.minutes(n) })),
      { value: 'custom', label: T.timerCustom },
    ],
    onchange: (value) => {
      custom.hidden = value !== 'custom';
      choose(value === 'custom' ? custom.getValue() : Number(value));
    },
  });
  return { node: el('div', { class: 'stack' }, group, custom, stop), cleanup: () => {} };
}
