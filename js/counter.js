// counter.js — Tràng hạt số: vòng tròn lớn để đếm, và màn hình "Niệm Phật".

import { BEADS_PER_ROUND, PHRASES } from './config.js';
import { S } from './strings.js';
import { toDateKey, dateKeyOfIso } from './dates.js';
import { getCountOfDate } from './storage.js';
import { getVerse, getRecordings } from './content.js';
import { createPractice } from './practice.js';
import { unlockSound } from './sound.js';
import { el, button, pageTitle, card, choiceGroup, toast } from './ui.js';
import { woodfishControl, countControl, timerControl } from './controls.js';
import { verseView } from './verses.js';

export const showSaveError = (error) => {
  console.error(error);
  toast(S.common.saveFailed);
};

// Phản ứng ngay khi ngón tay vừa chạm xuống, không đợi nhấc lên.
// "click" chỉ dùng cho bàn phím và phần mềm đọc màn hình (không có pointerdown đi trước).
function onPress(node, action) {
  let isHandled = false;
  node.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    isHandled = true;
    action();
  });
  node.addEventListener('click', () => {
    unlockSound(); // iPhone chỉ cho mở tiếng ở sự kiện này
    if (!isHandled) action();
    isHandled = false;
  });
  node.addEventListener('keydown', (event) => {
    if (event.repeat && (event.key === ' ' || event.key === 'Enter')) event.preventDefault();
  });
  node.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Dòng "Thời này niệm được ... câu" (không hiện nếu chỉ niệm mà không đếm).
export function summaryLine(practice) {
  if (practice.count === 0) return [];
  return [el('p', { class: 'center' }, S.counter.summary(S.common.number(practice.count)))];
}

function formatClock(totalSec) {
  const pad = (n) => String(n).padStart(2, '0');
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const rest = `${pad(minutes)}:${pad(totalSec % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

// ---------------------------------------------------------------------------
// Phần đếm dùng chung cho "Niệm Phật" và "Thời khóa"
// Trả về { node, cleanup }. Rời màn hình khi đang niệm thì tự tạm nghỉ.
// ---------------------------------------------------------------------------

export async function counterView(ctx, practice, { endLabel, onFinish }) {
  const T = S.counter;
  const countBefore = await getCountOfDate(
    practice.startedAt ? dateKeyOfIso(practice.startedAt) : toDateKey(),
    { exceptId: practice.id });

  const phrase = el('span', { class: 'bead-phrase' });
  const number = el('span', { class: 'bead-number' });
  const hint = el('span', { class: 'bead-hint' });
  const bead = el('button', { type: 'button', class: 'bead' }, phrase, number, hint);

  const sessionValue = el('dd', {});
  const todayValue = el('dd', {});
  const roundValue = el('dd', {});
  const clock = el('p', { class: 'clock' });
  const stat = (label, value) => el('div', { class: 'stat' }, el('dt', {}, label), value);

  const pauseButton = button('', {
    onclick: () => {
      if (practice.state === 'running') {
        practice.pause();
      } else {
        practice.start();
        bead.focus({ preventScroll: true }); // Để phím Space/Enter đếm tiếp được ngay
      }
    },
  });
  const endButton = button(endLabel, { variant: 'primary', onclick: () => practice.finish() });
  const actions = el('div', { class: 'row' }, pauseButton, endButton);

  onPress(bead, () => practice.tap());

  // --- Tự gõ mõ, gõ khánh; bớt câu; dòng báo của micro
  const knockButton = button(T.knock, { class: 'btn btn-secondary btn-strike' });
  onPress(knockButton, () => practice.knock());
  const chimeButton = button(T.chime, { class: 'btn btn-secondary btn-strike' });
  onPress(chimeButton, () => practice.chime());
  const strikes = el('div', { class: 'row' }, knockButton, chimeButton);
  const undoButton = button(T.undo, { onclick: () => practice.undo() });
  const micLine = el('p', { class: 'center' });

  // --- Bàn phím: Space/Enter đếm, trừ khi đang đứng ở một nút hay ô nhập khác.
  const isCountKey = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return false;
    if (event.ctrlKey || event.altKey || event.metaKey) return false;
    if (document.querySelector('dialog[open]')) return false;
    const control = event.target.closest?.('button, a, input, select, textarea, label, summary');
    return !control || control === bead;
  };
  const onKeyDown = (event) => {
    if (!isCountKey(event)) return;
    event.preventDefault();
    if (!event.repeat) practice.tap(); // Giữ phím không được tính thêm
  };
  const onKeyUp = (event) => {
    if (isCountKey(event)) event.preventDefault();
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // --- Cập nhật chữ số trên màn hình
  const update = () => {
    const { state, count } = practice;
    phrase.textContent = S.phrases[practice.phrase];
    number.textContent = S.common.number(count);
    const settings = ctx.getSettings();
    hint.textContent = (state === 'running' && T.runningHints[settings.countMode]) || T.hints[state] || '';
    knockButton.hidden = !settings.handWoodfish;
    chimeButton.hidden = !settings.handChime;
    strikes.hidden = knockButton.hidden && chimeButton.hidden;
    undoButton.hidden = count === 0;
    micLine.textContent = T.micStatus[practice.micStatus];
    micLine.hidden = practice.micStatus === 'off';
    bead.setAttribute('aria-label', T.beadLabel(S.phrases[practice.phrase], count));
    bead.style.setProperty('--progress', `${((count % BEADS_PER_ROUND) / BEADS_PER_ROUND) * 360}deg`);
    bead.classList.toggle('running', state === 'running');

    sessionValue.textContent = practice.goalCount === null
      ? S.common.number(count)
      : `${S.common.number(count)} / ${S.common.number(practice.goalCount)}`;
    todayValue.textContent = S.common.number(countBefore + count);
    roundValue.textContent = T.rounds(Math.floor(count / BEADS_PER_ROUND), count % BEADS_PER_ROUND);

    const remaining = practice.remainingSec();
    const elapsed = formatClock(practice.elapsedSec());
    if (practice.goalReached) clock.textContent = T.goalReached(elapsed);
    else clock.textContent = remaining === null ? T.elapsed(elapsed) : T.remaining(formatClock(remaining));
    actions.hidden = state === 'idle';
    pauseButton.textContent = state === 'running' ? T.pause : T.resume;
  };
  update();

  const removeListener = practice.onChange(() => {
    if (practice.state === 'finished' || practice.state === 'discarded') onFinish();
    else update();
  });

  const removeSettingsListener = ctx.onSettingsChange(update);

  return {
    node: el('div', { class: 'counter' },
      bead,
      clock,
      micLine,
      strikes,
      actions,
      el('dl', { class: 'stats' },
        stat(T.sessionCount, sessionValue),
        stat(T.todayCount, todayValue),
        stat(T.roundCount, roundValue)),
      undoButton),
    cleanup() {
      removeListener();
      removeSettingsListener();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      practice.pause();
    },
  };
}

// Chọn file ghi âm. Trả về null nếu chưa có file nào (khi đó giao diện ẩn đi).
export async function recordingControl(ctx, practice) {
  const recordings = await getRecordings();
  if (recordings.length === 0) return null;
  const apply = (id) => {
    const item = recordings.find((r) => r.id === id);
    practice.setRecording(item
      ? { url: item.url, onError: () => toast(S.counter.recordingFailed) }
      : null);
  };
  const saved = ctx.getSettings().recordingId;
  const current = recordings.some((r) => r.id === saved) ? saved : '';
  apply(current);
  return choiceGroup({
    name: 'recording', label: S.counter.recordingTitle, value: current,
    options: [
      { value: '', label: S.counter.recordingNone },
      ...recordings.map((r) => ({ value: r.id, label: r.title })),
    ],
    onchange: (recordingId) => {
      ctx.updateSettings({ recordingId });
      apply(recordingId);
    },
  });
}

// ---------------------------------------------------------------------------
// Màn hình "Niệm Phật"
// ---------------------------------------------------------------------------

let current = null;       // Thời niệm tự do đang mở (giữ lại khi sang màn hình khác)
let autoStart = false;

// Nút "Bắt đầu niệm Phật" ở màn hình Hôm nay gọi hàm này.
export function startFreePractice(ctx) {
  unlockSound();
  autoStart = true;
  ctx.navigate('#/niem-phat');
}

function getCurrentPractice(ctx) {
  const isOver = !current || current.state === 'finished' || current.state === 'discarded';
  const isOld = current?.startedAt && dateKeyOfIso(current.startedAt) !== toDateKey();
  if (isOld && !isOver) current.finish({ silent: true }); // Thời bỏ dở từ hôm trước: khép lại
  if (isOver || isOld || current.state === 'idle') {
    const settings = ctx.getSettings();
    current = createPractice({
      ctx, type: 'free', phrase: settings.phrase, onSaveError: showSaveError,
      goal: settings.timerMinutes > 0 ? { kind: 'minutes', value: settings.timerMinutes } : null,
    });
  }
  return current;
}

export async function renderCounter(page, ctx) {
  const T = S.counter;
  const shouldStart = autoStart;
  autoStart = false;
  const practice = getCurrentPractice(ctx);

  // Nạp sẵn bài Hồi hướng, để lúc niệm xong hiện ra ngay.
  const dedication = await getVerse('hoi-huong');
  const recording = await recordingControl(ctx, practice);
  const counter = await counterView(ctx, practice, {
    endLabel: T.end,
    onFinish: () => {
      if (practice.state === 'discarded') ctx.refresh();
      else showDedication();
    },
  });
  const woodfish = woodfishControl(ctx);
  const timer = timerControl(ctx, (minutes) => practice.setTimer(minutes));
  const counting = countControl(ctx, practice);
  const parts = [counter, woodfish, counting, timer];

  // Chỉ chọn câu niệm khi chưa bắt đầu.
  const phraseCard = card(T.phraseTitle, choiceGroup({
    name: 'phrase', label: T.phraseTitle, value: practice.phrase,
    options: PHRASES.map((value) => ({ value, label: S.phrases[value], hint: S.phraseLength[value] })),
    onchange: (phrase) => {
      ctx.updateSettings({ phrase });
      practice.setPhrase(phrase);
    },
  }));
  const updatePhraseCard = () => { phraseCard.hidden = practice.state !== 'idle'; };
  updatePhraseCard();
  const removeListener = practice.onChange(updatePhraseCard);

  page.append(
    pageTitle(T.title),
    counter.node,
    card(T.woodfishTitle, woodfish.node),
    card(T.countTitle, counting.node),
    card(T.timerTitle, timer.node),
    phraseCard);
  if (recording) page.append(card(T.recordingTitle, recording));

  let isCleaned = false;
  function cleanup() {
    if (isCleaned) return;
    isCleaned = true;
    removeListener();
    parts.forEach((part) => part.cleanup());
  }

  function showDedication() {
    cleanup();
    const title = pageTitle(dedication.title);
    page.replaceChildren(
      title,
      verseView(dedication),
      ...summaryLine(practice),
      button(T.done, { variant: 'primary', onclick: () => ctx.navigate('#/hom-nay') }));
    window.scrollTo(0, 0);
    title.focus({ preventScroll: true });
  }

  if (shouldStart) practice.start();
  return cleanup;
}
