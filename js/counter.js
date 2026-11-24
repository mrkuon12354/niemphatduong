// counter.js — Màn hình "Niệm Phật" (tràng hạt số). Làm ở Giai đoạn B.

import { S } from './strings.js';
import { comingSoon } from './ui.js';

export function renderCounter(page) {
  page.append(...comingSoon(S.counter.title, 'B'));
}
