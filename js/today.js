// today.js — Màn hình "Hôm nay".
// Ngày âm, ngày trai, ngày vía và câu khai thị sẽ thêm ở Giai đoạn C.

import { S } from './strings.js';
import { toDateKey } from './dates.js';
import { getCountOfDate } from './storage.js';
import { el, pageTitle, card } from './ui.js';

export async function renderToday(page, ctx) {
  const now = new Date();
  const dateKey = toDateKey(now);
  const count = await getCountOfDate(dateKey);

  page.append(
    pageTitle(S.today.title),
    el('p', { class: 'solar-date' }, S.today.solarDate(now)),
    el('a', { class: 'btn btn-primary btn-big', href: '#/niem-phat' }, S.today.start),
    card(S.today.countLabel,
      el('p', { class: 'big-number' },
        S.common.number(count), ' ',
        el('span', { class: 'big-number-unit' }, S.today.countUnit))));

  // App để mở qua nửa đêm: khi quay lại thì vẽ lại cho đúng ngày mới.
  const onVisible = () => {
    if (!document.hidden && toDateKey() !== dateKey) ctx.refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
