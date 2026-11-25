// controls.js — Các bộ nút chỉnh cài đặt niệm Phật.
// Hàm nào trả về { node, cleanup } thì khi rời màn hình phải gọi cleanup.

import {
  PHRASE_SECONDS, PHRASE_SECONDS_STEP, TIMER_CHOICES, MINUTES_LIMIT, BEATS_CHOICES,
  VOICE_SENSITIVITIES, VOICE_SAMPLE_PHRASES, VOICE_PHRASE_MS,
} from './config.js';
import { S } from './strings.js';
import { openMicrophone } from './microphone.js';
import { createPhraseCounter } from './voice.js';
import { el, button, toggle, choiceGroup, numberField, toast } from './ui.js';

// "Mỗi câu gõ mấy tiếng mõ?"
function beatsControl(ctx, name) {
  const T = S.counter;
  const group = choiceGroup({
    name, label: T.beatsTitle, inline: true,
    value: String(ctx.getSettings().beatsPerPhrase),
    options: BEATS_CHOICES.map((n) => ({ value: String(n), label: T.beats(n) })),
    onchange: (n) => ctx.updateSettings({ beatsPerPhrase: Number(n) }),
  });
  const node = el('div', { class: 'stack' }, el('p', { class: 'sub-title' }, T.beatsTitle), group);
  node.setValue = (n) => group.setValue(String(n));
  return node;
}

// Mõ (app gõ, tự gõ, không dùng), tốc độ mõ, và nút tự gõ khánh
export function woodfishControl(ctx) {
  const T = S.settings;
  const { min, max } = PHRASE_SECONDS;
  const seconds = numberField({
    label: T.secondsLabel, unit: T.secondsUnit, ...PHRASE_SECONDS,
    value: ctx.getSettings().secondsPerPhrase,
    onchange: (secondsPerPhrase) => ctx.updateSettings({ secondsPerPhrase }),
  });
  const step = (label, change) => button(label, {
    onclick: () => {
      const next = ctx.getSettings().secondsPerPhrase + change;
      ctx.updateSettings({ secondsPerPhrase: Number(Math.min(max, Math.max(min, next)).toFixed(1)) });
    },
  });
  const slower = step(T.woodfishSlower, PHRASE_SECONDS_STEP);
  const faster = step(T.woodfishFaster, -PHRASE_SECONDS_STEP);
  const beats = beatsControl(ctx, 'beats-auto');
  const speed = el('div', { class: 'stack' },
    el('p', { class: 'sub-title' }, T.secondsTitle),
    seconds, el('div', { class: 'row row-narrow' }, slower, faster), beats);

  const modeOf = (settings) => {
    if (settings.woodfishOn) return 'auto';
    return settings.handWoodfish ? 'hand' : 'off';
  };
  const modes = choiceGroup({
    name: 'woodfish', label: T.woodfishModeTitle, value: modeOf(ctx.getSettings()),
    options: ['auto', 'hand', 'off'].map((mode) => ({ value: mode, label: T.woodfishModes[mode] })),
    onchange: (mode) => {
      ctx.updateSettings({ woodfishOn: mode === 'auto', handWoodfish: mode === 'hand' });
    },
  });

  const update = (settings) => {
    modes.setValue(modeOf(settings));
    modes.hidden = settings.countMode === 'woodfish'; // Cách đếm đã định sẵn ai gõ mõ
    speed.hidden = !settings.woodfishOn;
    seconds.setValue(settings.secondsPerPhrase);
    beats.setValue(settings.beatsPerPhrase);
    slower.disabled = settings.secondsPerPhrase >= max;
    faster.disabled = settings.secondsPerPhrase <= min;
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

// Bốn cách đếm hiện cho người dùng. Hai cách đếm theo mõ khác nhau ở chỗ ai gõ.
export function countStyleOf(settings) {
  if (settings.countMode !== 'woodfish') return settings.countMode;
  return settings.woodfishOn ? 'autoWoodfish' : 'handWoodfish';
}

const COUNT_STYLES = {
  touch: { countMode: 'touch' },
  handWoodfish: { countMode: 'woodfish', woodfishOn: false, handWoodfish: true },
  autoWoodfish: { countMode: 'woodfish', woodfishOn: true, handWoodfish: false },
  voice: { countMode: 'voice', woodfishOn: false }, // Tắt mõ kẻo micro nghe nhầm
};

export function countControl(ctx) {
  const T = S.counter;
  const phrase = () => ctx.getSettings().phrase;

  const modes = choiceGroup({
    name: 'count-mode', label: T.countTitle, value: countStyleOf(ctx.getSettings()),
    options: Object.keys(COUNT_STYLES).map((value) => ({ value, ...T.countStyles[value] })),
    onchange: (style) => ctx.updateSettings(COUNT_STYLES[style]),
  });

  const beats = beatsControl(ctx, 'beats-hand');

  // --- Đo nhịp: nghe người dùng niệm mẫu vài câu rồi chia ra độ dài một câu
  let measuring = null; // { close, counter, totalMs }
  const tempo = el('p', { class: 'setting-value', 'aria-live': 'polite' });
  const guide = el('p', { 'aria-live': 'polite' });

  const saveTempo = (ms) => {
    const { [phrase()]: old, ...others } = ctx.getSettings().voicePhraseMs;
    ctx.updateSettings({ voicePhraseMs: ms ? { ...others, [phrase()]: ms } : others });
  };
  const stopMeasuring = () => {
    measuring?.close();
    measuring = null;
    update();
  };
  const startMeasuring = () => {
    const current = { totalMs: 0, status: 'starting', phrase: phrase() };
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
    tempo, guide, measure, forget, done, cancel,
    el('p', { class: 'sub-title' }, T.sensitivityTitle),
    choiceGroup({
      name: 'sensitivity', label: T.sensitivityTitle, inline: true,
      value: ctx.getSettings().voiceSensitivity,
      options: VOICE_SENSITIVITIES.map((value) => ({ value, label: T.sensitivities[value] })),
      onchange: (voiceSensitivity) => {
        if (measuring) stopMeasuring();
        ctx.updateSettings({ voiceSensitivity });
      },
    }));

  function update() {
    const settings = ctx.getSettings();
    modes.setValue(countStyleOf(settings));
    beats.setValue(settings.beatsPerPhrase);
    beats.hidden = countStyleOf(settings) !== 'handWoodfish'; // App gõ thì chọn ở phần Mõ và khánh
    voice.hidden = settings.countMode !== 'voice';

    const ms = settings.voicePhraseMs[phrase()];
    const status = measuring?.status;
    const isReady = status === 'listening';
    tempo.textContent = ms
      ? T.tempoKnown((ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }))
      : T.tempoUnknown;
    tempo.hidden = Boolean(measuring);
    guide.hidden = !measuring;
    if (measuring) {
      guide.textContent = isReady
        ? T.tempoGuide(S.phrases[phrase()], VOICE_SAMPLE_PHRASES)
        : T.micStatus[status];
    }
    measure.hidden = Boolean(measuring);
    forget.hidden = Boolean(measuring) || !ms;
    done.hidden = !isReady;
    cancel.hidden = !measuring;
  }
  update();

  const removeSettingsListener = ctx.onSettingsChange(() => {
    // Đổi cách đếm hoặc đổi câu niệm: thôi đo.
    const isStale = ctx.getSettings().countMode !== 'voice' || measuring?.phrase !== phrase();
    if (measuring && isStale) stopMeasuring();
    else update();
  });
  // Chuyển sang app khác: tắt micro.
  const onHidden = () => { if (document.hidden && measuring) stopMeasuring(); };
  document.addEventListener('visibilitychange', onHidden);

  return {
    node: el('div', { class: 'stack' }, modes, beats, voice),
    cleanup() {
      removeSettingsListener();
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
export function timerControl(ctx) {
  const T = S.counter;
  const current = ctx.getSettings().timerMinutes;
  const isCustom = current !== 0 && !TIMER_CHOICES.includes(current);

  const stop = stopControl(ctx);
  stop.hidden = current === 0;
  const choose = (minutes) => {
    stop.hidden = minutes === 0;
    ctx.updateSettings({ timerMinutes: minutes });
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
  return el('div', { class: 'stack' }, group, custom, stop);
}
