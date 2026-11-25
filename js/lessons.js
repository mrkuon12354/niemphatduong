// lessons.js — Màn hình "Bài học": danh sách bài và trang đọc một bài.
// Nội dung bài nằm trong content/lessons.json.

import { READ_MORE_LINKS } from './config.js';
import { S } from './strings.js';
import { toDateKey, dateKeyOfIso, onNewDay } from './dates.js';
import { getLearnedLessons, setLessonLearned } from './storage.js';
import { getLessons } from './content.js';
import { showSaveError } from './counter.js';
import { reviewLabel } from './verses.js';
import { el, button, pageTitle, card, menuLink } from './ui.js';

const T = S.lessons;
const WORDS_PER_MINUTE = 140; // Đọc chậm rãi

const lessonPath = (lesson) => `#/hoc/${lesson.id}`;

function readingMinutes(lesson) {
  const words = lesson.blocks
    .flatMap((block) => block.items ?? [block.text])
    .join(' ').split(' ').length;
  return Math.ceil(words / WORDS_PER_MINUTE);
}

// ---------------------------------------------------------------------------
// Danh sách bài
// ---------------------------------------------------------------------------

export async function renderLessons(page, ctx) {
  const [lessons, learned] = await Promise.all([getLessons(), getLearnedLessons()]);
  const done = lessons.filter((lesson) => learned.has(lesson.id));
  const next = lessons.find((lesson) => !learned.has(lesson.id));

  page.append(
    pageTitle(T.title),
    el('p', { class: 'setting-value center' }, T.progress(done.length, lessons.length)),
    nextCard(next, learned, ctx),
    el('h2', { class: 'sub-title' }, T.listTitle),
    ...lessons.map((lesson) => menuLink({
      href: lessonPath(lesson),
      label: T.item(lesson.order, lesson.title),
      note: learned.has(lesson.id) ? T.learned : T.minutes(readingMinutes(lesson)),
    })));

  return onNewDay(() => ctx.refresh());
}

// Gợi ý bài kế tiếp: mỗi ngày một bài, nhưng không khóa bài nào.
function nextCard(next, learned, ctx) {
  if (!next) return card(null, el('p', {}, T.allDone));
  const today = toDateKey();
  const learnedToday = [...learned.values()].some((time) => dateKeyOfIso(time) === today);
  return card(learnedToday ? T.tomorrowLabel : T.nextLabel,
    learnedToday ? el('p', {}, T.learnedToday) : null,
    el('p', { class: 'day-fact' }, T.item(next.order, next.title)),
    button(T.open, {
      variant: learnedToday ? 'secondary' : 'primary',
      onclick: () => ctx.navigate(lessonPath(next)),
    }));
}

// ---------------------------------------------------------------------------
// Trang đọc một bài
// ---------------------------------------------------------------------------

export async function renderLesson(page, ctx, lessonId) {
  const [lessons, learned] = await Promise.all([getLessons(), getLearnedLessons()]);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return renderLessons(page, ctx); // Địa chỉ cũ hoặc gõ sai
  const lesson = lessons[index];
  const next = lessons[index + 1];
  const actions = el('div', { class: 'stack' });

  function showActions(isLearned) {
    const mark = (value) => async (event) => {
      event.currentTarget.disabled = true; // Đợi ghi xong mới cho bấm tiếp
      try {
        await setLessonLearned(lesson.id, value);
        showActions(value);
        actions.querySelector('button').focus({ preventScroll: true });
      } catch (error) {
        showActions(isLearned);
        showSaveError(error);
      }
    };
    const backToList = (variant) => button(T.backToList, {
      variant, onclick: () => ctx.navigate('#/hoc'),
    });

    if (!isLearned) {
      actions.replaceChildren(
        button(T.markLearned, { variant: 'primary', onclick: mark(true) }),
        backToList('secondary'));
      return;
    }
    actions.replaceChildren(
      el('p', { class: 'setting-value center', role: 'status' }, T.learnedNote),
      next
        ? button(T.next, { variant: 'primary', onclick: () => ctx.navigate(lessonPath(next)) })
        : '',
      backToList(next ? 'secondary' : 'primary'),
      button(T.unmark, { onclick: mark(false) }));
  }
  showActions(learned.has(lesson.id));

  page.append(
    pageTitle(T.lessonTitle(lesson.order)),
    el('article', { class: 'card lesson' },
      reviewLabel(lesson, S.common.draftLabel),
      el('h2', { class: 'lesson-title' }, lesson.title),
      el('p', { class: 'muted' }, T.minutes(readingMinutes(lesson))),
      lesson.blocks.map(blockView),
      lesson.source ? el('p', { class: 'muted' }, lesson.source) : null),
    readMoreCard(),
    actions);
}

// Một đoạn của bài. type: heading | text | list | quote
function blockView(block) {
  switch (block.type) {
    case 'heading': return el('h3', { class: 'lesson-heading' }, block.text);
    case 'list': return el('ul', { class: 'list' }, block.items.map((item) => el('li', {}, item)));
    case 'quote': return quoteView(block);
    default: return el('p', {}, block.text);
  }
}

// Lời trích. Chưa có thì hiện chỗ trống để người thẩm định biết mà bổ sung.
function quoteView({ text, source, topic }) {
  if (!text) {
    return el('div', { class: 'quote-missing' },
      el('p', {}, T.quoteMissing),
      topic ? el('p', { class: 'muted' }, T.quoteTopic(topic)) : null);
  }
  return el('blockquote', { class: 'lesson-quote' },
    el('p', { class: 'quote' }, text),
    source ? el('p', { class: 'muted' }, source) : null);
}

function readMoreCard() {
  return card(T.readMoreTitle,
    el('div', { class: 'stack' },
      Object.entries(READ_MORE_LINKS).map(([id, href]) => menuLink({ href, ...T.readMore[id], external: true }))),
    el('p', { class: 'muted' }, T.readMoreNote));
}
