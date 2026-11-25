// app.js — Điểm khởi động: dựng khung app và chuyển qua lại giữa các màn hình.

import { APP_NAME, FONT_STEPS } from './config.js';
import { S } from './strings.js';
import { initStorage, getSettings, saveSettings, getStorageMode } from './storage.js';
import {
  el, icon, button, toast, applyAppearance, onSystemThemeChange, pageTitle, card, scrollToTop,
} from './ui.js';
import { preloadContent } from './content.js';
import { startReminders } from './reminders.js';
import { renderToday } from './today.js';
import { renderCounter } from './counter.js';
import { renderSchedule } from './schedule.js';
import { renderLessons } from './lessons.js';
import { renderCalendar } from './calendar.js';
import { renderThapNiem } from './thapniem.js';
import {
  renderSettings, renderPracticeSettings, renderScheduleSettings, renderDisplaySettings, renderDataSettings,
} from './settings.js';
import { renderAbout, renderPrivacy } from './info.js';

// Bảng màn hình: mỗi địa chỉ (#/...) ứng với một hàm vẽ.
// Màn hình có "nav" sẽ hiện ở thanh dưới cùng, theo đúng thứ tự này.
// "parent": trang con; thanh trên có nút quay lại.
const ROUTES = [
  { path: '#/hom-nay', nav: 'today', render: renderToday },
  { path: '#/niem-phat', nav: 'counter', render: renderCounter },
  { path: '#/thoi-khoa', nav: 'schedule', render: renderSchedule },
  { path: '#/hoc', nav: 'lessons', render: renderLessons },
  { path: '#/lich', nav: 'calendar', render: renderCalendar },
  { path: '#/thap-niem', parent: '#/thoi-khoa', render: renderThapNiem },
  { path: '#/cai-dat', parent: '#/hom-nay', render: renderSettings },
  { path: '#/cai-dat-niem-phat', parent: '#/cai-dat', render: renderPracticeSettings },
  { path: '#/cai-dat-thoi-khoa', parent: '#/cai-dat', render: renderScheduleSettings },
  { path: '#/cai-dat-hien-thi', parent: '#/cai-dat', render: renderDisplaySettings },
  { path: '#/cai-dat-du-lieu', parent: '#/cai-dat', render: renderDataSettings },
  { path: '#/gioi-thieu', parent: '#/cai-dat', render: renderAbout },
  { path: '#/rieng-tu', parent: '#/cai-dat', render: renderPrivacy },
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
  // Về trang đã mở trang này.
  goBack: () => { location.hash = trail.at(-2) ?? ROUTES[0].path; },
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
let backButton = null;
let headerTitle = null;

function buildShell() {
  const headerLink = (href, label, content) => el('a', {
    class: 'header-btn', href, 'aria-label': label, title: label,
  }, content);

  backButton = el('button', {
    type: 'button', class: 'header-btn', 'aria-label': S.header.back, title: S.header.back,
    onclick: () => ctx.goBack(),
  }, icon('back'));
  // Chữ này chỉ để nhìn; phần mềm đọc màn hình dùng thẻ h1 trong trang.
  headerTitle = el('span', { class: 'header-title', 'aria-hidden': 'true' });

  const header = el('header', { class: 'app-header' },
    el('div', { class: 'app-header-inner' },
      backButton,
      headerTitle,
      headerLink('#/cai-dat-hien-thi', S.header.display, 'Aa'),
      headerLink('#/cai-dat', S.header.settings, icon('settings'))));

  main = el('main', { class: 'app-main', id: 'main' });
  // Thanh trên luôn hiện đúng tiêu đề (h1) của trang, kể cả khi trang tự đổi bước.
  new MutationObserver(showTitle).observe(main, { childList: true, subtree: true });

  nav = el('nav', { class: 'app-nav', 'aria-label': S.nav.label },
    ROUTES.filter((route) => route.nav).map((route) =>
      el('a', {
        class: 'nav-item', href: route.path,
        // Bấm lại mục đang mở (ví dụ ở trang Hồi hướng) thì về đầu mục đó.
        onclick: () => {
          if (location.hash === route.path) renderCurrentRoute({ moveFocus: true });
        },
      },
        icon(route.nav),
        el('span', { class: 'nav-label' }, S.nav[route.nav]))));

  banner = el('div', { class: 'banner', role: 'status', hidden: true });

  document.getElementById('app').replaceChildren(header, banner, main, nav);
}

function showTitle() {
  const text = main.querySelector('h1')?.textContent ?? APP_NAME;
  if (headerTitle.textContent === text) return;
  headerTitle.textContent = text;
  document.title = text === APP_NAME ? APP_NAME : `${text} · ${APP_NAME}`;
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
let trail = []; // Đường đi tới trang đang mở, ví dụ ['#/hom-nay', '#/cai-dat']

function updateTrail(route) {
  if (trail.includes(route.path)) {
    trail = trail.slice(0, trail.indexOf(route.path) + 1);
  } else if (route.parent && trail.length > 0) {
    trail = [...trail, route.path];
  } else {
    trail = [];
    for (let r = route; r; r = ROUTES.find((other) => other.path === r.parent)) trail.unshift(r.path);
  }
}

// Mỗi hàm vẽ nhận (page, ctx), có thể trả về một hàm dọn dẹp,
// sẽ được gọi khi người dùng rời màn hình đó.
async function renderCurrentRoute({ moveFocus = false } = {}) {
  const route = ROUTES.find((r) => r.path === location.hash) ?? ROUTES[0];
  updateTrail(route);
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
    const href = link.getAttribute('href');
    if (href === trail[0]) link.setAttribute('aria-current', href === route.path ? 'page' : 'true');
    else link.removeAttribute('aria-current');
  }
  backButton.hidden = !route.parent;
  if (moveFocus) {
    scrollToTop();
    page.querySelector('h1')?.focus({ preventScroll: true });
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
  preloadContent();
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
