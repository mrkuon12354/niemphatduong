// schedule.js — Màn hình "Thời khóa": thời khóa sáng/tối, lối vào Thập niệm pháp.

import { S } from './strings.js';
import { toDateKey } from './dates.js';
import { getSessionsOfDate } from './storage.js';
import { getVerse } from './content.js';
import { createPractice } from './practice.js';
import { unlockSound } from './sound.js';
import { counterView, showSaveError, summaryLine } from './counter.js';
import { getThapNiemSummary } from './thapniem.js';
import { el, button, pageTitle, card, menuLink } from './ui.js';
import { verseView } from './verses.js';

// Thời khóa đang làm dở: { type: 'morning' | 'evening', step: 0..2, practice, dateKey }
// Giữ ở đây để lỡ bấm sang mục khác thì quay lại vẫn đúng bước đang làm.
let flow = null;

// Phần niệm Phật dài bao lâu, ví dụ "Niệm Phật 10 phút".
export function goalText({ goalKind, goalMinutes, goalCount }) {
  const T = S.schedule;
  if (goalKind === 'minutes') return T.goalMinutesText(S.common.number(goalMinutes));
  if (goalKind === 'count') return T.goalCountText(S.common.number(goalCount));
  return T.goalFreeText;
}

export async function renderSchedule(page, ctx) {
  let cleanups = [];
  let isGone = false;
  const cleanup = () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  };

  // Vẽ lại màn hình khi đổi bước.
  let drawNumber = 0;
  async function redraw() {
    const myNumber = ++drawNumber;
    cleanup();
    const content = flow ? await drawStep() : await drawHome();
    if (myNumber !== drawNumber) return; // Đã có lần vẽ mới hơn
    if (isGone) return cleanup();
    page.replaceChildren(...content);
    window.scrollTo(0, 0);
    page.querySelector('h1')?.focus({ preventScroll: true });
  }

  function goTo(step) {
    flow.step = step;
    redraw();
  }

  function exit() {
    cleanup(); // Thôi nghe bộ đếm trước, để việc kết thúc không nhảy sang Hồi hướng
    flow?.practice?.finish();
    flow = null;
    redraw();
  }

  function begin(type) {
    flow = { type, step: 0, practice: null, dateKey: toDateKey() };
    redraw();
  }

  // ------------------------------------------------------------- Trang chính

  async function drawHome() {
    const T = S.schedule;
    const sessions = await getSessionsOfDate(toDateKey());
    const thapNiem = await getThapNiemSummary(sessions);

    const startCard = (type) => card(T.names[type],
      sessions.some((s) => s.type === type) ? el('p', { class: 'muted' }, T.doneToday) : null,
      button(T.begin, { variant: 'primary', onclick: () => begin(type) }));

    return [
      pageTitle(T.title),
      startCard('morning'),
      startCard('evening'),
      menuLink({ href: '#/thap-niem', label: thapNiem.title, note: thapNiem.progress }),
      menuLink({
        href: '#/cai-dat-thoi-khoa', label: T.settingsLink, note: goalText(ctx.getSettings()),
      }),
    ];
  }

  // --------------------------------------------------------- Các bước thời khóa

  async function drawStep() {
    const T = S.schedule;
    const progress = el('p', { class: 'muted' }, T.progress(T.names[flow.type], flow.step + 1, 3));
    const exitButton = button(T.exit, { onclick: exit });

    if (flow.step === 0) {
      const verse = await getVerse('tan-phat-ke');
      return [
        progress, pageTitle(verse.title), verseView(verse),
        button(T.next, {
          variant: 'primary',
          onclick: () => {
            unlockSound(); // Mở tiếng ngay trong cái chạm này
            flow.practice = createFlowPractice();
            goTo(1);
            flow.practice.start();
          },
        }),
        exitButton,
      ];
    }

    if (flow.step === 1) {
      const { practice } = flow;
      const counter = await counterView(ctx, practice, {
        endLabel: T.next,
        onFinish: () => {
          if (practice.state === 'discarded') exit();
          else goTo(2);
        },
      });
      cleanups.push(counter.cleanup);
      const title = pageTitle(S.counter.title);
      title.classList.add('visually-hidden');
      return [progress, title, counter.node, exitButton];
    }

    const verse = await getVerse('hoi-huong');
    return [
      progress, pageTitle(verse.title), verseView(verse),
      ...summaryLine(flow.practice),
      button(T.finish, { variant: 'primary', onclick: exit }),
    ];
  }

  function createFlowPractice() {
    const s = ctx.getSettings();
    return createPractice({
      ctx, type: flow.type, phrase: s.phrase, onSaveError: showSaveError,
      goal: s.goalKind === 'free' ? null
        : { kind: s.goalKind, value: s.goalKind === 'count' ? s.goalCount : s.goalMinutes },
    });
  }

  // ------------------------------------------------------------------- Bắt đầu

  // Thời khóa bỏ dở từ hôm trước, hoặc dữ liệu vừa bị xóa: quay về trang chính.
  if (flow && (flow.dateKey !== toDateKey() || flow.practice?.state === 'discarded')) {
    flow.practice?.finish({ silent: true });
    flow = null;
  }

  page.append(...(flow ? await drawStep() : await drawHome()));

  // Để qua nửa đêm: các dòng "hôm nay" phải sang ngày mới.
  const dateKey = toDateKey();
  const onVisible = () => {
    if (!document.hidden && !flow && toDateKey() !== dateKey) ctx.refresh();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    isGone = true;
    document.removeEventListener('visibilitychange', onVisible);
    cleanup();
  };
}
