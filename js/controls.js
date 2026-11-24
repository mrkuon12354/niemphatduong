// controls.js — Các bộ nút chỉnh cài đặt dùng ở nhiều màn hình.
// Mỗi hàm trả về { node, cleanup }: phần tử để hiện, và hàm dọn dẹp khi rời màn hình.

import { WOODFISH_BPM, TIMER_CHOICES, MINUTES_LIMIT } from './config.js';
import { S } from './strings.js';
import { el, button, toggle, choiceGroup, numberField } from './ui.js';

// Bật/tắt mõ và chỉnh tốc độ
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

  const update = (settings) => {
    speed.hidden = !settings.woodfishOn;
    value.textContent = T.woodfishValue(settings.woodfishBpm);
    slower.disabled = settings.woodfishBpm <= WOODFISH_BPM.min;
    faster.disabled = settings.woodfishBpm >= WOODFISH_BPM.max;
  };
  update(ctx.getSettings());

  return {
    node: el('div', { class: 'stack' },
      toggle({
        label: T.woodfishLabel, checked: ctx.getSettings().woodfishOn,
        onchange: (woodfishOn) => ctx.updateSettings({ woodfishOn }),
      }),
      speed),
    cleanup: ctx.onSettingsChange(update),
  };
}

// Hẹn giờ niệm: các lựa chọn có sẵn hoặc tự nhập số phút
export function timerControl(ctx, onMinutes) {
  const T = S.counter;
  const current = ctx.getSettings().timerMinutes;
  const isCustom = current !== 0 && !TIMER_CHOICES.includes(current);

  const choose = (minutes) => {
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
  return { node: el('div', { class: 'stack' }, group, custom), cleanup: () => {} };
}
