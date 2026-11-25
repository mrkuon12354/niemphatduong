// almanac.js — Cho biết một ngày là ngày gì: ngày âm, ngày trai, ngày vía.
// Danh sách ngày trai, ngày vía nằm trong content/holidays.json.

import { getHolidayItems } from './content.js';
import { lunarOfDate } from './lunar.js';

// Tải danh sách rồi trả về hàm describeDay(date).
export async function loadAlmanac() {
  // Lỗi đọc file thì vẫn xem được ngày âm.
  const items = await getHolidayItems().catch(() => []);
  return (date) => {
    const lunar = lunarOfDate(date);
    return {
      lunar,
      isFasting: items.some((item) => item.type === 'fasting' && isFastingDay(item, lunar)),
      holidays: items.filter((item) => item.type === 'holiday' && isHoliday(item, lunar)),
    };
  };
}

function isFastingDay(item, lunar) {
  const days = lunar.monthLength === 30 ? item.days : item.daysInShortMonth;
  return days.includes(lunar.day);
}

// Ngày vía chỉ tính ở tháng thường, không tính lại ở tháng nhuận.
// Tháng thiếu không có ngày 30 thì lấy ngày 29.
function isHoliday(item, lunar) {
  return !lunar.isLeap
    && lunar.month === item.month
    && lunar.day === Math.min(item.day, lunar.monthLength);
}
