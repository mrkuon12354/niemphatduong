// counter.js — Tràng hạt số: vòng tròn lớn để đếm, và màn hình "Niệm Phật".
// Màn hình này chỉ để niệm. Mọi lựa chọn nằm ở trang "Cài đặt niệm Phật" (settings.js).

import { BEADS_PER_ROUND } from './config.js';
import { S } from './strings.js';
import { toDateKey, dateKeyOfIso } from './dates.js';
import { getCountOfDate } from './storage.js';
import { getVerse, getRecordings } from './content.js';
import { createPractice } from './practice.js';
import { unlockSound } from './sound.js';
import { el, button, pageTitle, toast, scrollToTop } from './ui.js';
import { countStyleOf } from './controls.js';
import { verseView } from './verses.js';

const MAX_BEAD_SIZE = 360; // px

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

// Tóm tắt các lựa chọn đang dùng, ví dụ "Chạm để đếm · Tự dừng"
function settingsSummary(settings, withTimer) {
  const T = S.counter;
  const parts = [T.countStyles[countStyleOf(settings)].label];
  if (withTimer) parts.push(settings.timerMinutes > 0 ? T.minutes(settings.timerMinutes) : T.timerNone);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Phần đếm dùng chung cho "Niệm Phật" và "Thời khóa"
// Trả về { node, cleanup }. Rời màn hình khi đang niệm thì tự tạm nghỉ.
// ---------------------------------------------------------------------------

export async function counterView(ctx, practice, { endLabel, onFinish, withTimer = false }) {
  const T = S.counter;
  await applyRecording(ctx, practice);
  const countBefore = await getCountOfDate(
    practice.startedAt ? dateKeyOfIso(practice.startedAt) : toDateKey(),
    { exceptId: practice.id });

  const phrase = el('span', { class: 'bead-phrase' });
  const number = el('span', { class: 'bead-number' });
  const hint = el('span', { class: 'bead-hint' });
  const bead = el('button', { type: 'button', class: 'bead' }, phrase, number, hint);
  // Cách "Gõ mõ để đếm": vòng tròn chính là cái mõ.
  const press = () => {
    if (countStyleOf(ctx.getSettings()) === 'handWoodfish') practice.knock();
    else practice.tap();
  };
  onPress(bead, press);

  // Vòng tròn to vừa phần trống còn lại của màn hình.
  const beadArea = el('div', { class: 'bead-area' }, bead);
  const resizeObserver = new ResizeObserver(() => {
    const size = Math.floor(Math.min(beadArea.clientWidth, beadArea.clientHeight, MAX_BEAD_SIZE));
    if (size > 0) beadArea.style.setProperty('--size', `${size}px`);
  });
  resizeObserver.observe(beadArea);

  const clock = el('p', { class: 'clock' });
  const micLine = el('p', {});
  const countLine = el('p', { class: 'muted' });

  // --- Tự gõ mõ, gõ khánh
  const knockButton = button(T.knock, { class: 'btn btn-secondary btn-strike' });
  onPress(knockButton, () => practice.knock());
  const chimeButton = button(T.chime, { class: 'btn btn-secondary btn-strike' });
  onPress(chimeButton, () => practice.chime());
  const strikes = el('div', { class: 'row row-narrow' }, knockButton, chimeButton);

  // --- Bắt đầu, tạm nghỉ, kết thúc, bớt một câu
  const startOrResume = () => {
    practice.start();
    bead.focus({ preventScroll: true }); // Để phím Space/Enter đếm được ngay
  };
  const startButton = button(T.start, { variant: 'primary', onclick: startOrResume });
  const pauseButton = button('', {
    onclick: () => (practice.state === 'running' ? practice.pause() : startOrResume()),
  });
  const endButton = button(endLabel, { variant: 'primary', onclick: () => practice.finish() });
  const actions = el('div', { class: 'row row-narrow' }, startButton, pauseButton, endButton);
  const undoButton = button(T.undo, { onclick: () => practice.undo() });

  // --- Lối vào trang cài đặt, chỉ hiện khi không niệm
  const settingsLink = el('a', { class: 'btn btn-secondary', href: '#/cai-dat-niem-phat' }, T.settingsLink);
  const tools = el('div', { class: 'row row-narrow' }, undoButton, settingsLink);

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
    if (!event.repeat) press(); // Giữ phím không được tính thêm
  };
  const onKeyUp = (event) => {
    if (isCountKey(event)) event.preventDefault();
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // --- Cập nhật chữ số trên màn hình
  // Các hàng nút luôn chiếm chỗ như nhau, để bấm vào không làm màn hình nhảy.
  const update = () => {
    const { state, count } = practice;
    const settings = ctx.getSettings();
    const isIdle = state === 'idle';
    const isRunning = state === 'running';
    const style = countStyleOf(settings);

    phrase.textContent = S.phrases[practice.phrase];
    number.textContent = S.common.number(count);
    if (isRunning) hint.textContent = T.runningHints[style];
    else hint.textContent = isIdle && style === 'handWoodfish' ? T.idleKnockHint : T.hints[state] ?? '';
    bead.setAttribute('aria-label', T.beadLabel(S.phrases[practice.phrase], count));
    bead.style.setProperty('--progress', `${((count % BEADS_PER_ROUND) / BEADS_PER_ROUND) * 360}deg`);
    bead.classList.toggle('running', isRunning);

    const remaining = practice.remainingSec();
    const elapsed = formatClock(practice.elapsedSec());
    if (practice.goalReached) clock.textContent = T.goalReached(elapsed);
    else if (isIdle) clock.textContent = settingsSummary(settings, withTimer);
    else clock.textContent = remaining === null ? T.elapsed(elapsed) : T.remaining(formatClock(remaining));

    micLine.textContent = T.micStatus[practice.micStatus] || '\u00a0';
    micLine.hidden = style !== 'voice';

    const lines = [practice.goalCount === null
      ? T.todayLine(S.common.number(countBefore + count))
      : T.goalLine(S.common.number(count), S.common.number(practice.goalCount))];
    if (count >= BEADS_PER_ROUND) {
      lines.push(T.rounds(Math.floor(count / BEADS_PER_ROUND), count % BEADS_PER_ROUND));
    }
    countLine.textContent = lines.join(' · ');

    knockButton.hidden = !settings.handWoodfish || style === 'handWoodfish';
    chimeButton.hidden = !settings.handChime;
    strikes.hidden = knockButton.hidden && chimeButton.hidden;
    startButton.hidden = !isIdle;
    pauseButton.hidden = isIdle;
    endButton.hidden = isIdle;
    pauseButton.textContent = isRunning ? T.pause : T.resume;
    undoButton.disabled = count === 0;
    settingsLink.hidden = isRunning;
  };
  update();

  const removeListener = practice.onChange(() => {
    if (practice.state === 'finished' || practice.state === 'discarded') onFinish();
    else update();
  });

  return {
    node: el('div', { class: 'counter' },
      beadArea,
      el('div', { class: 'status' }, clock, countLine, micLine),
      strikes, actions, tools),
    cleanup() {
      resizeObserver.disconnect();
      removeListener();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      practice.pause();
    },
  };
}

// Dùng file ghi âm đã chọn trong cài đặt (nếu có).
async function applyRecording(ctx, practice) {
  const id = ctx.getSettings().recordingId;
  const item = id ? (await getRecordings()).find((r) => r.id === id) : null;
  practice.setRecording(item
    ? { url: item.url, onError: () => toast(S.counter.recordingFailed) }
    : null);
}

// ---------------------------------------------------------------------------
// Màn hình "Niệm Phật"
// ---------------------------------------------------------------------------

let current = null;       // Thời niệm tự do đang mở (giữ lại khi sang màn hình khác)
let currentTimer = 0;     // Số phút đã hẹn cho thời niệm đó
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
  const { phrase, timerMinutes } = ctx.getSettings();
  if (isOver || isOld || current.state === 'idle') {
    current = createPractice({
      ctx, type: 'free', phrase, onSaveError: showSaveError,
      goal: timerMinutes > 0 ? { kind: 'minutes', value: timerMinutes } : null,
    });
  } else if (timerMinutes !== currentTimer) {
    current.setTimer(timerMinutes); // Vừa đổi hẹn giờ trong lúc tạm nghỉ
  }
  currentTimer = timerMinutes;
  return current;
}

export async function renderCounter(page, ctx) {
  const T = S.counter;
  const shouldStart = autoStart;
  autoStart = false;
  const practice = getCurrentPractice(ctx);

  const counter = await counterView(ctx, practice, {
    endLabel: T.end,
    withTimer: true,
    onFinish: () => {
      if (practice.state === 'discarded') ctx.refresh();
      else showDedication();
    },
  });

  page.append(pageTitle(T.title), counter.node);

  let isCleaned = false;
  function cleanup() {
    if (isCleaned) return;
    isCleaned = true;
    counter.cleanup();
  }

  async function showDedication() {
    cleanup();
    // Bài Hồi hướng đã tải sẵn lúc mở app; lỡ mất mạng thì vẫn hiện số câu vừa niệm.
    const dedication = await getVerse('hoi-huong').catch(() => null);
    const heading = pageTitle(dedication?.title ?? T.title);
    page.replaceChildren(
      heading,
      dedication ? verseView(dedication) : '',
      ...summaryLine(practice),
      button(T.done, { variant: 'primary', onclick: () => ctx.navigate('#/hom-nay') }));
    scrollToTop();
    heading.focus({ preventScroll: true });
  }

  if (shouldStart) practice.start();
  return cleanup;
}
