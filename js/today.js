// today.js — Màn hình "Hôm nay".
// Ngày âm, ngày trai, ngày vía và câu khai thị sẽ thêm ở Giai đoạn C.

import { APP_NAME } from './config.js';
import { S } from './strings.js';
import { toDateKey } from './dates.js';
import { getCountOfDate } from './storage.js';
import { startFreePractice } from './counter.js';
import { el, button, pageTitle, card, menuLink } from './ui.js';

export async function renderToday(page, ctx) {
  const now = new Date();
  const dateKey = toDateKey(now);
  const count = await getCountOfDate(dateKey);

  page.append(
    pageTitle(APP_NAME),
    el('p', { class: 'solar-date center' }, S.today.solarDate(now)),
    button(S.today.start, { variant: 'primary btn-big', onclick: () => startFreePractice(ctx) }),
    card(S.today.countLabel,
      el('p', { class: 'big-number' },
        S.common.number(count), ' ',
        el('span', { class: 'big-number-unit' }, S.today.countUnit))),
    menuLink({ href: '#/cai-dat', label: S.settings.title }));

  // App để mở qua nửa đêm: khi quay lại thì vẽ lại cho đúng ngày mới.
  const onVisible = () => {
    if (!document.hidden && toDateKey() !== dateKey) ctx.refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
