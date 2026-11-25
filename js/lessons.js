// lessons.js — Màn hình "Bài học". Làm ở Giai đoạn D.

import { S } from './strings.js';
import { comingSoon } from './ui.js';

export function renderLessons(page) {
  page.append(...comingSoon(S.lessons.title, 'D'));
}
