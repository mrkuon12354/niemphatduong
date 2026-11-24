// device.js — Các khả năng của máy: rung, giữ sáng màn hình.
// Máy nào không hỗ trợ thì lặng lẽ bỏ qua, không làm lỗi app.

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Bỏ qua
  }
}

let wantAwake = false;
let lock = null;

async function requestLock() {
  if (!wantAwake || lock || document.hidden || !navigator.wakeLock) return;
  try {
    const newLock = await navigator.wakeLock.request('screen');
    // Trong lúc chờ, người dùng đã nghỉ niệm: thả ra ngay.
    if (!wantAwake || lock) return newLock.release();
    lock = newLock;
    lock.addEventListener('release', () => { if (lock === newLock) lock = null; });
  } catch {
    // Máy đang tiết kiệm pin hoặc không cho phép: bỏ qua.
  }
}

export function keepAwake(on) {
  wantAwake = on;
  if (on) {
    requestLock();
  } else {
    lock?.release();
    lock = null;
  }
}

// Khi chuyển sang app khác, hệ thống tự thả khóa; quay lại thì xin lại.
document.addEventListener('visibilitychange', requestLock);
