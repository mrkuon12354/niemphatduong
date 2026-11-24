// reminders.js — Nhắc giờ thời khóa.
// App không có máy chủ nên chỉ nhắc được khi đang mở (kể cả đang ở chế độ nền).
// Trang Cài đặt có nói rõ điều này với người dùng.

import { S } from './strings.js';
import { toDateKey } from './dates.js';
import { getReminderLog, saveReminderLog, getSessionsOfDate } from './storage.js';
import { isPracticing } from './practice.js';

const LATE_MINUTES = 30; // Trễ quá chừng này thì thôi, không nhắc nữa

// 'unsupported' | 'default' (chưa hỏi) | 'granted' (cho phép) | 'denied' (từ chối)
export function notificationStatus() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function askNotificationPermission() {
  try {
    await Notification.requestPermission();
  } catch (error) {
    console.warn('Không xin được quyền thông báo.', error);
  }
  return notificationStatus();
}

async function showSystemNotification(title) {
  if (notificationStatus() !== 'granted') return;
  try {
    // Android chỉ cho thông báo qua service worker (có từ Giai đoạn E).
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(title, { tag: 'reminder' });
    else new Notification(title, { tag: 'reminder' });
  } catch (error) {
    console.warn('Không hiện được thông báo.', error);
  }
}

function minutesLate(time, now) {
  const [hours, minutes] = time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() - (hours * 60 + minutes);
}

// onRemind(type): app hiện dải nhắc trên màn hình.
export function startReminders(ctx, onRemind) {
  let isChecking = false;

  async function check() {
    if (isChecking || isPracticing()) return; // Đang niệm thì không quấy rầy
    isChecking = true;
    try {
      const s = ctx.getSettings();
      const plans = [
        { type: 'morning', on: s.remindMorningOn, time: s.remindMorningTime },
        { type: 'evening', on: s.remindEveningOn, time: s.remindEveningTime },
      ];
      const now = new Date();
      for (const { type, on, time } of plans) {
        const late = minutesLate(time, now);
        if (!on || late < 0 || late >= LATE_MINUTES) continue;
        const mark = `${toDateKey(now)} ${time}`;
        if ((await getReminderLog())[type] === mark) continue; // Đã nhắc rồi
        await saveReminderLog({ [type]: mark });
        const sessions = await getSessionsOfDate(toDateKey(now));
        if (sessions.some((session) => session.type === type)) continue; // Đã làm rồi
        onRemind(type);
        if (document.hidden) await showSystemNotification(S.reminder.text[type]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      isChecking = false;
    }
  }

  check();
  setInterval(check, 20000);
  document.addEventListener('visibilitychange', check);
}
