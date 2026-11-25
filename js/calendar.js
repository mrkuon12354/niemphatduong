// calendar.js — Màn hình "Lịch tháng". Làm ở Giai đoạn C.

import { S } from './strings.js';
import { comingSoon } from './ui.js';

export function renderCalendar(page) {
  page.append(...comingSoon(S.calendar.title, 'C'));
}
