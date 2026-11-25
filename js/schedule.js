// schedule.js — Màn hình "Thời khóa": thời khóa sáng/tối và Thập niệm pháp.

import { MINUTES_LIMIT, COUNT_LIMIT } from './config.js';
import { S } from './strings.js';
import { toDateKey, toLocalIso } from './dates.js';
import { getSessionsOfDate, addSession, deleteSession } from './storage.js';
import { getVerse, getPractice } from './content.js';
import { createPractice } from './practice.js';
import { unlockSound } from './sound.js';
import { counterView, recordingControl, showSaveError, summaryLine } from './counter.js';
import { woodfishControl, countControl, stopControl } from './controls.js';
import { el, button, pageTitle, card, choiceGroup, numberField, toggle } from './ui.js';
import { verseView, reviewLabel } from './verses.js';

// Thời khóa đang làm dở: { type: 'morning' | 'evening', step: 0..2, practice, dateKey }
// Giữ ở đây để lỡ bấm sang mục khác thì quay lại vẫn đúng bước đang làm.
let flow = null;

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
    const settings = ctx.getSettings();

    const startCard = (type) => card(T.names[type],
      sessions.some((s) => s.type === type) ? el('p', { class: 'muted' }, T.doneToday) : null,
      button(T.begin, { variant: 'primary', onclick: () => begin(type) }));

    const minutes = numberField({
      label: T.goalMinutes, value: settings.goalMinutes, ...MINUTES_LIMIT,
      onchange: (goalMinutes) => ctx.updateSettings({ goalMinutes }),
    });
    const count = numberField({
      label: T.goalCount, value: settings.goalCount, ...COUNT_LIMIT,
      onchange: (goalCount) => ctx.updateSettings({ goalCount }),
    });
    const stop = stopControl(ctx);
    const showGoal = (kind) => {
      stop.hidden = kind === 'free';
      minutes.hidden = kind !== 'minutes';
      count.hidden = kind !== 'count';
    };
    showGoal(settings.goalKind);

    return [
      pageTitle(T.title),
      startCard('morning'),
      startCard('evening'),
      card(T.goalTitle,
        el('div', { class: 'stack' },
          choiceGroup({
            name: 'goal', label: T.goalTitle, value: settings.goalKind,
            options: [
              { value: 'minutes', label: T.goalByMinutes },
              { value: 'count', label: T.goalByCount },
              { value: 'free', label: T.goalFree },
            ],
            onchange: (goalKind) => {
              ctx.updateSettings({ goalKind });
              showGoal(goalKind);
            },
          }),
          minutes, count, stop)),
      await drawThapNiem(sessions),
      el('a', { class: 'btn btn-secondary', href: '#/cai-dat' }, T.setReminder),
    ];
  }

  // --------------------------------------------------------- Các bước thời khóa

  async function drawStep() {
    const T = S.schedule;
    const heading = [
      el('p', { class: 'muted' }, T.progress(T.names[flow.type], flow.step + 1, 3)),
    ];
    const exitButton = button(T.exit, { onclick: exit });

    if (flow.step === 0) {
      const verse = await getVerse('tan-phat-ke');
      return [
        ...heading, pageTitle(verse.title), verseView(verse),
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
      const recording = await recordingControl(ctx, practice);
      const counter = await counterView(ctx, practice, {
        endLabel: T.next,
        onFinish: () => {
          if (practice.state === 'discarded') exit();
          else goTo(2);
        },
      });
      const woodfish = woodfishControl(ctx);
      const counting = countControl(ctx, practice);
      cleanups.push(counter.cleanup, woodfish.cleanup, counting.cleanup);
      return [
        ...heading, pageTitle(S.counter.title), counter.node,
        card(S.counter.woodfishTitle, woodfish.node),
        card(S.counter.countTitle, counting.node),
        ...(recording ? [card(S.counter.recordingTitle, recording)] : []),
        exitButton,
      ];
    }

    const verse = await getVerse('hoi-huong');
    return [
      ...heading, pageTitle(verse.title), verseView(verse),
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

  // ------------------------------------------------------------- Thập niệm pháp

  async function drawThapNiem(sessions) {
    const T = S.schedule;
    const info = await getPractice('thap-niem');
    // slot -> danh sách id các bản ghi hôm nay của lần đó
    const done = new Map();
    for (const s of sessions) {
      if (s.type === 'thapniem' && s.slot) done.set(s.slot, [...(done.get(s.slot) ?? []), s.id]);
    }
    const summary = el('p', { class: 'setting-value', 'aria-live': 'polite' });
    const updateSummary = () => {
      const checked = info.slots.filter((slot) => done.get(slot.id)?.length).length;
      summary.textContent = T.thapNiemProgress(checked, info.slots.length);
    };
    updateSummary();

    const rows = info.slots.map((slot) => {
      const row = toggle({
        label: slot.label,
        checked: Boolean(done.get(slot.id)?.length),
        onchange: async (checked) => {
          const input = row.querySelector('input');
          input.disabled = true; // Đợi ghi xong mới cho chạm tiếp
          try {
            if (checked) {
              const now = toLocalIso();
              const record = await addSession({
                startedAt: now, endedAt: now, phrase: info.phrase,
                count: info.countPerSlot, durationSec: 0, type: 'thapniem', slot: slot.id,
              });
              done.set(slot.id, [record.id]);
            } else {
              for (const id of done.get(slot.id) ?? []) await deleteSession(id);
              done.delete(slot.id);
            }
            updateSummary();
          } catch (error) {
            input.checked = !checked;
            showSaveError(error);
          }
          input.disabled = false;
        },
      });
      return row;
    });

    return card(info.title,
      reviewLabel(info),
      ...info.description.map((text) => el('p', {}, text)),
      summary,
      el('div', { class: 'choices' }, rows));
  }

  // ------------------------------------------------------------------- Bắt đầu

  // Thời khóa bỏ dở từ hôm trước, hoặc dữ liệu vừa bị xóa: quay về trang chính.
  if (flow && (flow.dateKey !== toDateKey() || flow.practice?.state === 'discarded')) {
    flow.practice?.finish({ silent: true });
    flow = null;
  }

  page.append(...(flow ? await drawStep() : await drawHome()));

  // Để qua nửa đêm: bảng Thập niệm phải sang ngày mới.
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
