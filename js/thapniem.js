// thapniem.js — Trang "Thập niệm pháp": đánh dấu các lần niệm 10 câu trong ngày.

import { S } from './strings.js';
import { toDateKey, toLocalIso } from './dates.js';
import { getSessionsOfDate, addSession, deleteSession } from './storage.js';
import { getPractice } from './content.js';
import { showSaveError } from './counter.js';
import { el, button, pageTitle, card, toggle } from './ui.js';
import { reviewLabel } from './verses.js';

// slot (lần nào trong ngày) -> danh sách id các bản ghi hôm nay của lần đó
function groupBySlot(sessions) {
  const done = new Map();
  for (const s of sessions) {
    if (s.type === 'thapniem' && s.slot) done.set(s.slot, [...(done.get(s.slot) ?? []), s.id]);
  }
  return done;
}

const progressText = (info, done) => S.schedule.thapNiemProgress(
  info.slots.filter((slot) => done.get(slot.id)?.length).length, info.slots.length);

// Dòng "Hôm nay: 3 trên 9 lần" cho màn hình Thời khóa.
export async function getThapNiemSummary(sessions) {
  const info = await getPractice('thap-niem');
  return { title: info.title, progress: progressText(info, groupBySlot(sessions)) };
}

export async function renderThapNiem(page, ctx) {
  const dateKey = toDateKey();
  const info = await getPractice('thap-niem');
  const done = groupBySlot(await getSessionsOfDate(dateKey));

  const summary = el('p', { class: 'setting-value', 'aria-live': 'polite' });
  const updateSummary = () => { summary.textContent = progressText(info, done); };
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

  page.append(
    pageTitle(info.title),
    card(null,
      reviewLabel(info),
      ...info.description.map((text) => el('p', {}, text)),
      summary,
      el('div', { class: 'choices' }, rows)),
    button(S.common.done, { variant: 'primary', onclick: ctx.goBack }));

  // Để qua nửa đêm: bảng phải sang ngày mới.
  const onVisible = () => {
    if (!document.hidden && toDateKey() !== dateKey) ctx.refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
