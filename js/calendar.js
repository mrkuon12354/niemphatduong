// calendar.js — Màn hình "Lịch tháng": ngày dương, ngày âm, ngày trai, ngày vía.

import { CALENDAR_YEARS } from './config.js';
import { S } from './strings.js';
import { toDateKey, onNewDay } from './dates.js';
import { loadAlmanac } from './almanac.js';
import { getCountsByDate } from './storage.js';
import { reviewLabel } from './verses.js';
import { el, icon, button, pageTitle, card } from './ui.js';

const T = S.calendar;

export async function renderCalendar(page, ctx) {
  const [describeDay, counts] = await Promise.all([loadAlmanac(), getCountsByDate()]);
  const today = new Date();
  const todayKey = toDateKey(today);
  let selected = today;
  let shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const monthTitle = el('h2', { class: 'month-title', 'aria-live': 'polite' });
  const previous = monthButton('back', T.previousMonth, () => moveMonth(-1));
  const next = monthButton('forward', T.nextMonth, () => moveMonth(1));
  const grid = el('div', { class: 'month-grid', role: 'group', 'aria-label': T.title });
  const backToToday = button(T.backToToday, {
    onclick: () => {
      shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      selectDay(today);
    },
  });
  const details = el('section', { class: 'card day-details', 'aria-live': 'polite' });

  function moveMonth(step) {
    shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + step, 1);
    showMonth();
  }

  function selectDay(date) {
    selected = date;
    showMonth();
    showDetails();
  }

  function showMonth() {
    const year = shownMonth.getFullYear();
    const month = shownMonth.getMonth();
    const length = new Date(year, month + 1, 0).getDate();
    const emptyCells = (shownMonth.getDay() + 6) % 7; // Tuần bắt đầu từ Thứ Hai
    const selectedKey = toDateKey(selected);

    monthTitle.textContent = T.month(shownMonth);
    previous.disabled = month === 0 && year <= CALENDAR_YEARS.min;
    next.disabled = month === 11 && year >= CALENDAR_YEARS.max;

    const cells = Array.from({ length }, (_, i) => dayCell(new Date(year, month, i + 1), selectedKey));
    cells[0].style.gridColumnStart = emptyCells + 1;
    grid.replaceChildren(
      ...S.weekdaysShort.map((name) => el('span', { class: 'weekday', 'aria-hidden': 'true' }, name)),
      ...cells);
    backToToday.disabled = selectedKey === todayKey && toDateKey(shownMonth).slice(0, 7) === todayKey.slice(0, 7);
  }

  function dayCell(date, selectedKey) {
    const key = toDateKey(date);
    const day = describeDay(date);
    const { lunar, isFasting, holidays } = day;
    const classes = ['day'];
    if (isFasting || holidays.length > 0) classes.push('special');
    if (holidays.length > 0) classes.push('holiday');
    if (key === todayKey) classes.push('today');
    if (key === selectedKey) classes.push('selected');
    return el('button', {
      type: 'button', class: classes.join(' '),
      'aria-label': T.dayLabel(date, day),
      'aria-pressed': String(key === selectedKey),
      'aria-current': key === todayKey ? 'date' : null,
      onclick: () => {
        selectDay(date);
        // Cuộn vừa đủ để thấy phần giải thích, nhưng vẫn thấy ngày vừa bấm.
        const cell = grid.querySelector('.selected');
        cell.focus({ preventScroll: true });
        details.scrollIntoView({ block: 'nearest' });
        cell.scrollIntoView({ block: 'nearest' });
      },
    },
      el('span', { class: 'day-solar' }, date.getDate()),
      // Ngày đầu tháng âm thì ghi thêm tháng, ví dụ 1/10.
      el('span', { class: 'day-lunar' }, lunar.day === 1 ? `1/${lunar.month}` : lunar.day),
      el('span', { class: isFasting ? 'day-dot on' : 'day-dot' }));
  }

  function showDetails() {
    const key = toDateKey(selected);
    const { lunar, isFasting, holidays } = describeDay(selected);
    details.replaceChildren(
      el('h2', { class: 'card-title' }, T.dayTitle(selected)),
      el('p', { class: 'day-fact' }, S.lunar.fullDate(lunar)),
      isFasting ? el('p', { class: 'day-fact' }, T.fasting(lunar)) : '',
      ...holidays.map((holiday) => el('p', { class: 'day-fact' }, T.holiday(holiday.title, lunar))),
      holidays.length > 0 ? reviewLabel(holidays[0]) ?? '' : '',
      !isFasting && holidays.length === 0 ? el('p', {}, T.ordinary) : '',
      // Ngày chưa tới thì chưa có số câu.
      key <= todayKey ? el('p', {}, T.count(S.common.number(counts.get(key) ?? 0))) : '');
  }

  showMonth();
  showDetails();
  page.append(
    pageTitle(T.title),
    el('div', { class: 'month-bar' }, previous, monthTitle, next),
    grid,
    details,
    el('div', { class: 'legend' },
      el('span', { class: 'legend-item' }, el('span', { class: 'day-dot on' }), T.legendFasting),
      el('span', { class: 'legend-item' }, el('span', { class: 'legend-box' }), T.legendHoliday)),
    backToToday,
    card(null,
      el('p', { class: 'review-label' }, S.common.reviewLabel),
      el('p', { class: 'muted' }, T.reviewNote)));

  return onNewDay(() => ctx.refresh());
}

function monthButton(iconName, label, onclick) {
  return el('button', {
    type: 'button', class: 'header-btn month-btn', 'aria-label': label, title: label, onclick,
  }, icon(iconName));
}
