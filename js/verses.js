// verses.js — Hiển thị bài kệ bằng chữ to.

import { S } from './strings.js';
import { el } from './ui.js';

// Nhãn cho nội dung chưa thẩm định; nội dung đã duyệt thì không hiện gì.
export function reviewLabel(item, text = S.common.reviewLabel) {
  return item.status === 'reviewed'
    ? null
    : el('p', { class: 'review-label' }, text);
}

export function verseView(verse) {
  return el('section', { class: 'card verse' },
    reviewLabel(verse),
    verse.lines.map((line) => el('p', { class: 'verse-line' }, line)));
}
