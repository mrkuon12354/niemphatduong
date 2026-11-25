// today.js — Màn hình "Hôm nay".

import { APP_NAME } from './config.js';
import { S } from './strings.js';
import { toDateKey, onNewDay } from './dates.js';
import { toJulianDay } from './lunar.js';
import { loadAlmanac } from './almanac.js';
import { getQuoteOfDay } from './content.js';
import { getCountOfDate } from './storage.js';
import { startFreePractice } from './counter.js';
import { reviewLabel } from './verses.js';
import { el, button, pageTitle, card, menuLink } from './ui.js';

export async function renderToday(page, ctx) {
  const now = new Date();
  const [describeDay, count, quote] = await Promise.all([
    loadAlmanac(),
    getCountOfDate(toDateKey(now)),
    getQuoteOfDay(toJulianDay(now.getFullYear(), now.getMonth() + 1, now.getDate())).catch(() => null),
  ]);
  const day = describeDay(now);

  page.append(
    pageTitle(APP_NAME),
    el('div', { class: 'center' },
      el('p', { class: 'solar-date' }, S.today.solarDate(now)),
      el('p', { class: 'lunar-date' }, S.lunar.fullDate(day.lunar))),
    ...dayNotice(day),
    button(S.today.start, { variant: 'primary btn-big', onclick: () => startFreePractice(ctx) }),
    card(S.today.countLabel,
      el('p', { class: 'big-number' },
        S.common.number(count), ' ',
        el('span', { class: 'big-number-unit' }, S.today.countUnit))),
    ...quoteCard(quote),
    menuLink({ href: '#/cai-dat', label: S.settings.title }));

  return onNewDay(() => ctx.refresh());
}

// Báo nhẹ khi hôm nay là ngày trai hoặc ngày vía.
function dayNotice({ lunar, isFasting, holidays }) {
  if (!isFasting && holidays.length === 0) return [];
  return [
    el('div', { class: 'notice' },
      isFasting ? el('p', {}, S.today.fasting(lunar)) : null,
      holidays.map((holiday) => el('p', {}, S.today.holiday(holiday.title))),
      holidays.length > 0 ? reviewLabel(holidays[0]) : null),
  ];
}

function quoteCard(quote) {
  if (!quote) return [];
  return [
    card(S.today.quoteTitle,
      reviewLabel(quote),
      el('p', { class: 'quote' }, quote.text),
      quote.source ? el('p', { class: 'muted' }, quote.source) : null),
  ];
}
