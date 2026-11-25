// settings.js — Màn hình "Cài đặt": một trang mục lục và bốn trang con.

import { APP_VERSION, PHRASES, THEMES, MINUTES_LIMIT, COUNT_LIMIT } from './config.js';
import { S } from './strings.js';
import { toDateKey } from './dates.js';
import { exportAll, importAll, eraseAll, getSessions, getStorageMode, BackupError } from './storage.js';
import { getRecordings } from './content.js';
import { discardAllPractices } from './practice.js';
import { notificationStatus, askNotificationPermission } from './reminders.js';
import { woodfishControl, countControl, timerControl, stopControl } from './controls.js';
import { goalText } from './schedule.js';
import {
  el, button, pageTitle, card, menuLink, choiceGroup, toggle, numberField, timeField, toast,
  confirmDialog,
} from './ui.js';

// Nút cuối mỗi trang con. Cài đặt đã lưu ngay khi chọn, nút này chỉ để quay về.
const doneButton = (ctx) => button(S.settings.done, { variant: 'primary', onclick: ctx.goBack });

// ---------------------------------------------------------------------------
// Mục lục
// ---------------------------------------------------------------------------

export function renderSettings(page, ctx) {
  const T = S.settings;
  page.append(
    pageTitle(T.title),
    el('div', { class: 'stack' },
      menuLink({ href: '#/cai-dat-niem-phat', ...T.menu.practice }),
      menuLink({
        href: '#/cai-dat-thoi-khoa', label: T.menu.schedule.label, note: goalText(ctx.getSettings()),
      }),
      menuLink({ href: '#/cai-dat-hien-thi', ...T.menu.display }),
      menuLink({ href: '#/cai-dat-du-lieu', ...T.menu.data }),
      menuLink({ href: '#/gioi-thieu', label: T.about }),
      menuLink({ href: '#/rieng-tu', label: T.privacy })),
    el('p', { class: 'muted center' }, T.version(APP_VERSION)));
}

// ---------------------------------------------------------------------------
// Niệm Phật: câu niệm, cách đếm, mõ và khánh, hẹn giờ, ghi âm, rung
// ---------------------------------------------------------------------------

export async function renderPracticeSettings(page, ctx) {
  const T = S.settings;
  const settings = ctx.getSettings();
  const counting = countControl(ctx);
  const woodfish = woodfishControl(ctx);
  const recordings = await getRecordings();

  page.append(
    pageTitle(T.menu.practice.title),
    card(S.counter.phraseTitle,
      choiceGroup({
        name: 'phrase', label: S.counter.phraseTitle, value: settings.phrase,
        options: PHRASES.map((value) => ({
          value, label: S.phrases[value], hint: S.phraseLength[value],
        })),
        onchange: (phrase) => ctx.updateSettings({ phrase }),
      })),
    card(S.counter.countTitle, counting.node),
    card(T.woodfishTitle, woodfish.node),
    card(S.counter.timerTitle, timerControl(ctx)));

  if (recordings.length > 0) {
    page.append(card(S.counter.recordingTitle,
      choiceGroup({
        name: 'recording', label: S.counter.recordingTitle,
        value: recordings.some((r) => r.id === settings.recordingId) ? settings.recordingId : '',
        options: [
          { value: '', label: S.counter.recordingNone },
          ...recordings.map((r) => ({ value: r.id, label: r.title })),
        ],
        onchange: (recordingId) => ctx.updateSettings({ recordingId }),
      })));
  }

  page.append(
    card(T.vibrateTitle,
      toggle({
        label: T.vibrateLabel, checked: settings.vibrate,
        onchange: (vibrate) => ctx.updateSettings({ vibrate }),
      }),
      el('p', { class: 'muted' }, T.vibrateHint)),
    doneButton(ctx));

  return () => {
    counting.cleanup();
    woodfish.cleanup();
  };
}

// ---------------------------------------------------------------------------
// Thời khóa và giờ nhắc
// ---------------------------------------------------------------------------

export function renderScheduleSettings(page, ctx) {
  const T = S.schedule;
  const settings = ctx.getSettings();

  const minutes = numberField({
    label: T.goalMinutes, value: settings.goalMinutes, ...MINUTES_LIMIT,
    onchange: (goalMinutes) => ctx.updateSettings({ goalMinutes }),
  });
  const count = numberField({
    label: T.goalCount, value: settings.goalCount, ...COUNT_LIMIT,
    onchange: (goalCount) => ctx.updateSettings({ goalCount }),
  });
  const stop = stopControl(ctx);
  const showGoal = (kind) => {
    minutes.hidden = kind !== 'minutes';
    count.hidden = kind !== 'count';
    stop.hidden = kind === 'free';
  };
  showGoal(settings.goalKind);

  page.append(
    pageTitle(S.settings.menu.schedule.label),
    card(T.goalTitle,
      el('div', { class: 'stack' },
        choiceGroup({
          name: 'goal', label: T.goalTitle, value: settings.goalKind,
          options: [
            { value: 'minutes', label: T.goalByMinutes },
            { value: 'count', label: T.goalByCount },
            { value: 'free', label: T.goalFree },
          ],
          onchange: (goalKind) => {
            ctx.updateSettings({ goalKind });
            showGoal(goalKind);
          },
        }),
        minutes, count, stop)),
    reminderCard(ctx),
    doneButton(ctx));
}

function reminderCard(ctx) {
  const T = S.settings;
  const settings = ctx.getSettings();

  const plan = (label, onKey, timeKey) => {
    const time = timeField({
      label: T.reminderTime, value: settings[timeKey],
      onchange: (value) => ctx.updateSettings({ [timeKey]: value }),
    });
    time.hidden = !settings[onKey];
    return [
      toggle({
        label, checked: settings[onKey],
        onchange: (checked) => {
          time.hidden = !checked;
          ctx.updateSettings({ [onKey]: checked });
        },
      }),
      time,
    ];
  };

  const status = el('p', { class: 'muted' });
  const ask = button(T.reminderAsk, {
    onclick: async () => showStatus(await askNotificationPermission()),
  });
  const showStatus = (value) => {
    status.textContent = T.reminderStatus[value];
    ask.hidden = value !== 'default';
  };
  showStatus(notificationStatus());

  return card(T.reminderTitle,
    el('div', { class: 'stack' },
      plan(T.reminderMorning, 'remindMorningOn', 'remindMorningTime'),
      plan(T.reminderEvening, 'remindEveningOn', 'remindEveningTime'),
      el('p', {}, T.reminderNote),
      status,
      ask));
}

// ---------------------------------------------------------------------------
// Chữ và màu nền
// ---------------------------------------------------------------------------

export function renderDisplaySettings(page, ctx) {
  const T = S.settings;

  const fontStep = (label, direction) => button(label, {
    onclick: () => {
      const size = ctx.nextFontSize(direction);
      if (size) ctx.updateSettings({ fontSize: size });
    },
  });
  const smaller = fontStep(T.fontSmaller, -1);
  const larger = fontStep(T.fontLarger, 1);

  // Cập nhật các nút khi cài đặt đổi (kể cả đổi bằng nút A−/A+ trên đầu trang).
  const update = () => {
    smaller.disabled = !ctx.nextFontSize(-1);
    larger.disabled = !ctx.nextFontSize(1);
  };
  update();

  page.append(
    pageTitle(T.menu.display.label),
    card(T.fontTitle,
      el('p', {}, T.fontSample),
      el('div', { class: 'row' }, smaller, larger)),
    card(T.themeTitle,
      choiceGroup({
        name: 'theme', label: T.themeTitle, value: ctx.getSettings().theme,
        options: THEMES.map((value) => ({ value, label: T.themes[value] })),
        onchange: (theme) => ctx.updateSettings({ theme }),
      }),
      el('p', { class: 'muted' }, T.themeHint)),
    doneButton(ctx));

  return ctx.onSettingsChange(update);
}

// ---------------------------------------------------------------------------
// Dữ liệu của tôi
// ---------------------------------------------------------------------------

export async function renderDataSettings(page, ctx) {
  const T = S.settings;
  const sessions = await getSessions();
  const mode = await getStorageMode();
  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: () => restore(fileInput, ctx),
  });

  page.append(
    pageTitle(T.dataTitle),
    card(null,
      mode === 'memory' ? el('p', { class: 'warning' }, S.common.notSaving) : null,
      el('p', {}, T.dataIntro),
      el('p', { class: 'muted' }, T.sessionCount(S.common.number(sessions.length))),
      el('div', { class: 'stack' },
        button(T.backup, { onclick: backup }),
        button(T.restore, { onclick: () => fileInput.click() }),
        fileInput,
        button(T.erase, { variant: 'danger', onclick: () => erase(ctx) }))),
    doneButton(ctx));
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
    discardAllPractices();
    await eraseAll();
    await ctx.reloadSettings();
    await ctx.refresh();
    toast(S.settings.eraseDone);
  } catch (error) {
    console.error(error);
    toast(S.common.saveFailed);
  }
}
