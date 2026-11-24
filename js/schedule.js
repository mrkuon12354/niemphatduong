// schedule.js — Màn hình "Thời khóa". Làm ở Giai đoạn B.

import { S } from './strings.js';
import { comingSoon } from './ui.js';

export function renderSchedule(page) {
  page.append(...comingSoon(S.schedule.title, 'B'));
}
