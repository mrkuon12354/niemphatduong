// settings.js — Màn hình "Cài đặt". (Giờ nhắc thời khóa sẽ thêm ở Giai đoạn B.)

import { APP_VERSION, PHRASES, THEMES, WOODFISH_BPM } from './config.js';
import { S } from './strings.js';
import { toDateKey } from './dates.js';
import { exportAll, importAll, eraseAll, getSessions, getStorageMode, BackupError } from './storage.js';
import { el, button, pageTitle, card, choiceGroup, toggle, toast, confirmDialog } from './ui.js';

export async function renderSettings(page, ctx) {
  const T = S.settings;
  const settings = ctx.getSettings();
  const sessions = await getSessions();
  const mode = await getStorageMode();

  // --- Cỡ chữ ---
  const fontStep = (label, direction) => button(label, {
    onclick: () => {
      const size = ctx.nextFontSize(direction);
      if (size) ctx.updateSettings({ fontSize: size });
    },
  });
  const smaller = fontStep(T.fontSmaller, -1);
  const larger = fontStep(T.fontLarger, 1);

  // --- Tốc độ mõ ---
  const bpmText = el('p', { class: 'setting-value', 'aria-live': 'polite' });
  const bpmStep = (label, direction) => button(label, {
    onclick: () => {
      const next = ctx.getSettings().woodfishBpm + direction * WOODFISH_BPM.step;
      ctx.updateSettings({
        woodfishBpm: Math.min(WOODFISH_BPM.max, Math.max(WOODFISH_BPM.min, next)),
      });
    },
  });
  const slower = bpmStep(T.woodfishSlower, -1);
  const faster = bpmStep(T.woodfishFaster, 1);

  // Cập nhật các nút khi cài đặt đổi (kể cả đổi bằng nút A−/A+ trên đầu trang).
  const update = (s) => {
    smaller.disabled = !ctx.nextFontSize(-1);
    larger.disabled = !ctx.nextFontSize(1);
    bpmText.textContent = T.woodfishValue(s.woodfishBpm);
    slower.disabled = s.woodfishBpm <= WOODFISH_BPM.min;
    faster.disabled = s.woodfishBpm >= WOODFISH_BPM.max;
  };
  update(settings);

  // --- Dữ liệu ---
  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: () => restore(fileInput, ctx),
  });

  page.append(
    pageTitle(T.title),
    card(T.fontTitle,
      el('p', {}, T.fontSample),
      el('div', { class: 'row' }, smaller, larger)),
    card(T.themeTitle,
      choiceGroup({
        name: 'theme', label: T.themeTitle, value: settings.theme,
        options: THEMES.map((value) => ({ value, label: T.themes[value] })),
        onchange: (theme) => ctx.updateSettings({ theme }),
      }),
      el('p', { class: 'muted' }, T.themeHint)),
    card(T.phraseTitle,
      choiceGroup({
        name: 'phrase', label: T.phraseTitle, value: settings.phrase,
        options: PHRASES.map((value) => ({
          value, label: S.phrases[value], hint: S.phraseLength[value],
        })),
        onchange: (phrase) => ctx.updateSettings({ phrase }),
      })),
    card(T.woodfishTitle,
      bpmText,
      el('div', { class: 'row' }, slower, faster)),
    card(T.vibrateTitle,
      toggle({
        label: T.vibrateLabel, checked: settings.vibrate,
        onchange: (vibrate) => ctx.updateSettings({ vibrate }),
      }),
      el('p', { class: 'muted' }, T.vibrateHint)),
    card(T.dataTitle,
      mode === 'memory' ? el('p', { class: 'warning' }, S.common.notSaving) : null,
      el('p', {}, T.dataIntro),
      el('p', { class: 'muted' }, T.sessionCount(S.common.number(sessions.length))),
      el('div', { class: 'stack' },
        button(T.backup, { onclick: backup }),
        button(T.restore, { onclick: () => fileInput.click() }),
        fileInput,
        button(T.erase, { variant: 'danger', onclick: () => erase(ctx) }))),
    card(T.moreTitle,
      el('div', { class: 'stack' },
        el('a', { class: 'btn btn-secondary', href: '#/gioi-thieu' }, T.about),
        el('a', { class: 'btn btn-secondary', href: '#/rieng-tu' }, T.privacy)),
      el('p', { class: 'muted' }, T.version(APP_VERSION))));

  return ctx.onSettingsChange(update);
}

async function backup() {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: S.settings.backupFilename(toDateKey()) });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast(S.settings.backupDone);
}

async function restore(fileInput, ctx) {
  const file = fileInput.files[0];
  fileInput.value = ''; // Để có thể chọn lại đúng file này lần nữa
  if (!file) return;
  try {
    const { added, skipped } = await importAll(await file.text());
    await ctx.reloadSettings();
    await ctx.refresh();
    toast(S.settings.restoreDone(added, skipped));
  } catch (error) {
    if (!(error instanceof BackupError)) console.error(error);
    toast(S.settings.restoreErrors[error.code] ?? S.common.saveFailed);
  }
}

async function erase(ctx) {
  const ok = await confirmDialog({
    title: S.settings.eraseConfirmTitle,
    message: S.settings.eraseConfirmBody,
    yes: S.settings.eraseConfirmYes,
  });
  if (!ok) return;
  try {
    await eraseAll();
    await ctx.reloadSettings();
    await ctx.refresh();
    toast(S.settings.eraseDone);
  } catch (error) {
    console.error(error);
    toast(S.common.saveFailed);
  }
}
