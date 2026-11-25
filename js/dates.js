// dates.js — Các hàm nhỏ xử lý ngày giờ.

const pad = (n) => String(n).padStart(2, '0');

// Đổi Date thành chuỗi ISO có múi giờ, ví dụ "2026-11-25T05:30:00.000+07:00".
// Không dùng toISOString() vì hàm đó đổi sang giờ quốc tế (UTC):
// niệm lúc 5 giờ sáng ở Việt Nam sẽ bị ghi thành ngày hôm trước.
export function toLocalIso(date = new Date()) {
  const offset = -date.getTimezoneOffset(); // Việt Nam: +420 phút
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${toDateKey(date)}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${String(date.getMilliseconds()).padStart(3, '0')}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// "Khóa ngày" dạng "2026-11-25" theo giờ của máy.
export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// App để mở qua nửa đêm: khi quay lại thì gọi callback để vẽ lại cho đúng ngày mới.
// Trả về hàm để thôi theo dõi.
export function onNewDay(callback) {
  const dateKey = toDateKey();
  const check = () => {
    if (!document.hidden && toDateKey() !== dateKey) callback();
  };
  document.addEventListener('visibilitychange', check);
  return () => document.removeEventListener('visibilitychange', check);
}

// Lấy ngày từ chuỗi ISO. Giữ nguyên ngày tại nơi người dùng đã niệm.
export function dateKeyOfIso(iso) {
  return iso.slice(0, 10);
}
