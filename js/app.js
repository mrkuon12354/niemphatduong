// app.js — Điểm khởi động: dựng khung app và chuyển qua lại giữa các màn hình.

import { APP_NAME, FONT_STEPS } from './config.js';
import { S } from './strings.js';
import { initStorage, getSettings, saveSettings, getStorageMode } from './storage.js';
import {
  el, icon, button, toast, applyAppearance, onSystemThemeChange, pageTitle, card,
} from './ui.js';
import { startReminders } from './reminders.js';
import { renderToday } from './today.js';
import { renderCounter } from './counter.js';
import { renderSchedule } from './schedule.js';
import { renderLessons } from './lessons.js';
import { renderCalendar } from './calendar.js';
import { renderSettings } from './settings.js';
import { renderAbout, renderPrivacy } from './info.js';

// Bảng màn hình: mỗi địa chỉ (#/...) ứng với một hàm vẽ.
// Màn hình có "nav" sẽ hiện ở thanh dưới cùng, theo đúng thứ tự này.
const ROUTES = [
  { path: '#/hom-nay', nav: 'today', render: renderToday },
  { path: '#/niem-phat', nav: 'counter', render: renderCounter },
  { path: '#/thoi-khoa', nav: 'schedule', render: renderSchedule },
  { path: '#/hoc', nav: 'lessons', render: renderLessons },
  { path: '#/lich', nav: 'calendar', render: renderCalendar },
  { path: '#/cai-dat', render: renderSettings },
  { path: '#/gioi-thieu', render: renderAbout },
  { path: '#/rieng-tu', render: renderPrivacy },
];

let settings = null;
const settingsListeners = new Set();

// ctx ("ngữ cảnh"): những thứ mọi màn hình được phép dùng.
const ctx = {
  getSettings: () => settings,

  // Đổi cài đặt: áp dụng ngay trên màn hình, rồi mới ghi xuống máy.
  async updateSettings(patch) {
    settings = { ...settings, ...patch };
    showSettings();
    try {
      await saveSettings(patch);
    } catch (error) {
      console.error(error);
      toast(S.common.saveFailed);
    }
  },

  // Đọc lại cài đặt từ máy (dùng sau khi khôi phục hoặc xóa dữ liệu).
  async reloadSettings() {
    settings = await getSettings();
    showSettings();
  },

  // Đăng ký nghe khi cài đặt đổi. Trả về hàm để hủy đăng ký.
  onSettingsChange(listener) {
    settingsListeners.add(listener);
    return () => settingsListeners.delete(listener);
  },

  navigate: (path) => { location.hash = path; },
  refresh: () => renderCurrentRoute(),
};

function showSettings() {
  applyAppearance(settings);
  settingsListeners.forEach((listener) => listener(settings));
}

// Cỡ chữ kế tiếp; direction = -1 (nhỏ hơn) hoặc 1 (to hơn). Hết nấc thì undefined.
ctx.nextFontSize = (direction) => FONT_STEPS[FONT_STEPS.indexOf(settings.fontSize) + direction];

// ---------------------------------------------------------------------------
// Khung app
// ---------------------------------------------------------------------------

let main = null;
let nav = null;
let banner = null;

function buildShell() {
  const fontButton = (label, text, direction) => {
    const node = el('button', {
      type: 'button', class: 'header-btn', 'aria-label': label, title: label,
      onclick: () => {
        const size = ctx.nextFontSize(direction);
        if (size) ctx.updateSettings({ fontSize: size });
      },
    }, text);
    const update = () => { node.disabled = !ctx.nextFontSize(direction); };
    ctx.onSettingsChange(update);
    update();
    return node;
  };

  const header = el('header', { class: 'app-header' },
    el('div', { class: 'app-header-inner' },
      el('a', { class: 'app-name', href: '#/hom-nay' }, APP_NAME),
      fontButton(S.header.fontSmaller, 'A−', -1),
      fontButton(S.header.fontLarger, 'A+', 1),
      el('a', {
        class: 'header-btn', href: '#/cai-dat',
        'aria-label': S.header.settings, title: S.header.settings,
      }, icon('settings'))));

  main = el('main', { class: 'app-main', id: 'main' });

  nav = el('nav', { class: 'app-nav', 'aria-label': S.nav.label },
    ROUTES.filter((route) => route.nav).map((route) =>
      el('a', { class: 'nav-item', href: route.path },
        icon(route.nav),
        el('span', { class: 'nav-label' }, S.nav[route.nav]))));

  banner = el('div', { class: 'banner', role: 'status', hidden: true });

  document.getElementById('app').replaceChildren(header, banner, main, nav);
}

// Dải nhắc giờ thời khóa ở đầu màn hình, nằm yên cho tới khi người dùng bấm.
function showReminder(type) {
  const close = () => { banner.hidden = true; };
  banner.replaceChildren(
    el('p', {}, S.reminder.text[type]),
    el('div', { class: 'row' },
      button(S.reminder.open, {
        variant: 'primary',
        onclick: () => {
          close();
          ctx.navigate('#/thoi-khoa');
        },
      }),
      button(S.reminder.later, { onclick: close })));
  banner.hidden = false;
}

// ---------------------------------------------------------------------------
// Chuyển màn hình
// ---------------------------------------------------------------------------

let cleanup = null; // Hàm dọn dẹp của màn hình đang mở (nếu có)
let renderNumber = 0;

// Mỗi hàm vẽ nhận (page, ctx), có thể trả về một hàm dọn dẹp,
// sẽ được gọi khi người dùng rời màn hình đó.
async function renderCurrentRoute({ moveFocus = false } = {}) {
  const route = ROUTES.find((r) => r.path === location.hash) ?? ROUTES[0];
  const myNumber = ++renderNumber;
  cleanup?.();
  cleanup = null;

  const page = el('div', { class: 'page' });
  let pageCleanup = null;
  try {
    pageCleanup = await route.render(page, ctx);
  } catch (error) {
    console.error(error);
    page.replaceChildren(pageTitle(S.common.errorTitle), card(null, el('p', {}, S.common.errorBody)));
  }

  // Trong lúc chờ, người dùng đã bấm sang màn hình khác: bỏ kết quả này.
  if (myNumber !== renderNumber) {
    pageCleanup?.();
    return;
  }
  cleanup = pageCleanup ?? null;

  main.replaceChildren(page);
  for (const link of nav.children) {
    if (link.getAttribute('href') === route.path) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const heading = page.querySelector('h1');
  document.title = heading ? `${heading.textContent} · ${APP_NAME}` : APP_NAME;
  if (moveFocus) {
    window.scrollTo(0, 0);
    heading?.focus({ preventScroll: true });
  }
}

// ---------------------------------------------------------------------------
// Khởi động
// ---------------------------------------------------------------------------

async function start() {
  await initStorage();
  settings = await getSettings();
  applyAppearance(settings);
  onSystemThemeChange(() => applyAppearance(settings));
  buildShell();
  window.addEventListener('hashchange', () => renderCurrentRoute({ moveFocus: true }));
  await renderCurrentRoute();
  startReminders(ctx, showReminder);
  if ((await getStorageMode()) === 'memory') toast(S.common.notSaving);
}

start().catch((error) => {
  console.error(error);
  document.getElementById('app').replaceChildren(
    el('main', { class: 'app-main' },
      el('h1', {}, S.common.errorTitle),
      el('p', {}, S.common.errorBody)));
});
