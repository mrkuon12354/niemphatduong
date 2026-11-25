// lunar.js — Đổi ngày dương sang ngày âm lịch Việt Nam (múi giờ +7).
// Theo thuật toán của Hồ Ngọc Đức (Computing the Vietnamese lunar calendar).
//
// Ý chính:
// - Tháng âm bắt đầu vào ngày có "sóc" (trăng mới), tính theo giờ Việt Nam.
// - Tháng 11 âm luôn là tháng chứa ngày Đông chí.
// - Giữa hai tháng 11 mà có 13 tháng thì năm đó nhuận: tháng đầu tiên không chứa
//   "trung khí" là tháng nhuận.
//
// Để tính cho dễ, mỗi ngày được đổi thành một số nguyên liên tục ("ngày Julius").

const TIME_ZONE = 7;
const SYNODIC_MONTH = 29.530588853; // Số ngày trung bình giữa hai lần trăng mới
const FIRST_NEW_MOON = 2415021.076998695; // Một lần trăng mới đầu năm 1900
const RAD = Math.PI / 180;

const { floor, sin } = Math;

// Ngày dương → số ngày Julius. Ví dụ 1/1/2000 → 2451545
export function toJulianDay(year, month, day) {
  const a = floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045;
}

// Ngày Julius của lần trăng mới thứ k (tính từ đầu năm 1900), theo giờ Việt Nam.
function newMoonDay(k) {
  const t = k / 1236.85; // Thế kỷ tính từ 1900
  const t2 = t * t;
  const t3 = t2 * t;
  const mean = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3
    + 0.00033 * sin((166.56 + 132.87 * t - 0.009173 * t2) * RAD);
  const sun = (359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3) * RAD;
  const moon = (306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3) * RAD;
  const node = (21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3) * RAD;
  const correction = (0.1734 - 0.000393 * t) * sin(sun) + 0.0021 * sin(2 * sun)
    - 0.4068 * sin(moon) + 0.0161 * sin(2 * moon) - 0.0004 * sin(3 * moon)
    + 0.0104 * sin(2 * node) - 0.0051 * sin(sun + moon)
    - 0.0074 * sin(sun - moon) + 0.0004 * sin(2 * node + sun)
    - 0.0004 * sin(2 * node - sun) - 0.0006 * sin(2 * node + moon)
    + 0.0010 * sin(2 * node - moon) + 0.0005 * sin(2 * moon + sun);
  const deltaT = t < -11
    ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
    : -0.000278 + 0.000265 * t + 0.000262 * t2;
  return floor(mean + correction - deltaT + 0.5 + TIME_ZONE / 24);
}

// Mặt trời đang ở cung nào (0–11, mỗi cung 30 độ) lúc 0 giờ ngày ấy, giờ Việt Nam.
function sunSector(julianDay) {
  const t = (julianDay - 0.5 - TIME_ZONE / 24 - 2451545) / 36525; // Thế kỷ tính từ 2000
  const t2 = t * t;
  const anomaly = (357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t * t2) * RAD;
  const meanLongitude = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  const correction = (1.914600 - 0.004817 * t - 0.000014 * t2) * sin(anomaly)
    + (0.019993 - 0.000101 * t) * sin(2 * anomaly) + 0.000290 * sin(3 * anomaly);
  const longitude = (meanLongitude + correction) % 360;
  return floor(((longitude + 360) % 360) / 30);
}

// Ngày đầu tháng 11 âm của một năm (tháng chứa Đông chí).
function startOfMonth11(year) {
  const k = floor((toJulianDay(year, 12, 31) - 2415021) / SYNODIC_MONTH);
  const start = newMoonDay(k);
  return sunSector(start) >= 9 ? newMoonDay(k - 1) : start;
}

// Tháng nhuận đứng thứ mấy sau tháng 11 bắt đầu ở ngày month11.
function leapMonthOffset(month11) {
  const k = floor((month11 - FIRST_NEW_MOON) / SYNODIC_MONTH + 0.5);
  let i = 1;
  let sector = sunSector(newMoonDay(k + i));
  let previous;
  do {
    previous = sector;
    i += 1;
    sector = sunSector(newMoonDay(k + i));
  } while (sector !== previous && i < 14);
  return i - 1;
}

// Ngày dương → ngày âm.
// Trả về { day, month, year, isLeap: tháng nhuận?, monthLength: 29 hoặc 30 }
export function solarToLunar(year, month, day) {
  const today = toJulianDay(year, month, day);

  // Tháng âm chứa ngày này: từ monthStart đến ngay trước nextStart.
  let k = floor((today - FIRST_NEW_MOON) / SYNODIC_MONTH);
  while (newMoonDay(k + 1) <= today) k += 1;
  while (newMoonDay(k) > today) k -= 1;
  const monthStart = newMoonDay(k);
  const nextStart = newMoonDay(k + 1);

  // Hai tháng 11 âm nằm trước và sau ngày này.
  let previous11 = startOfMonth11(year);
  let next11 = previous11;
  let lunarYear;
  if (previous11 >= monthStart) {
    lunarYear = year;
    previous11 = startOfMonth11(year - 1);
  } else {
    lunarYear = year + 1;
    next11 = startOfMonth11(year + 1);
  }

  const monthsAfter11 = floor((monthStart - previous11) / 29);
  let lunarMonth = monthsAfter11 + 11;
  let isLeap = false;
  if (next11 - previous11 > 365) { // Năm nhuận
    const leapOffset = leapMonthOffset(previous11);
    if (monthsAfter11 >= leapOffset) {
      lunarMonth = monthsAfter11 + 10;
      isLeap = monthsAfter11 === leapOffset;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && monthsAfter11 < 4) lunarYear -= 1;

  return {
    day: today - monthStart + 1,
    month: lunarMonth,
    year: lunarYear,
    isLeap,
    monthLength: nextStart - monthStart,
  };
}

export function lunarOfDate(date) {
  return solarToLunar(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

// ---------------------------------------------------------------------------
// Tự kiểm tra với những ngày đã biết chắc
// ---------------------------------------------------------------------------

// [năm, tháng, ngày dương, "ngày/tháng/năm âm" ("n" là tháng nhuận)]
const KNOWN_DATES = [
  [1985, 1, 21, '1/1/1985'], // Việt Nam ăn Tết trước Trung Quốc một tháng
  [2000, 2, 5, '1/1/2000'],
  [2007, 2, 17, '1/1/2007'], // Trước Trung Quốc một ngày, vì khác múi giờ
  [2020, 1, 25, '1/1/2020'],
  [2020, 5, 23, '1/4n/2020'],
  [2023, 1, 22, '1/1/2023'],
  [2023, 3, 22, '1/2n/2023'],
  [2024, 2, 10, '1/1/2024'],
  [2025, 1, 29, '1/1/2025'],
  [2025, 7, 25, '1/6n/2025'],
  [2026, 2, 16, '29/12/2025'],
  [2026, 2, 17, '1/1/2026'],
  [2027, 2, 6, '1/1/2027'],
  [2028, 1, 26, '1/1/2028'],
  [2030, 2, 2, '1/1/2030'], // Trước Trung Quốc một ngày
];

// Trả về danh sách lỗi; danh sách trống nghĩa là đúng hết.
export function checkLunar() {
  const errors = [];
  for (const [year, month, day, expected] of KNOWN_DATES) {
    const lunar = solarToLunar(year, month, day);
    const actual = `${lunar.day}/${lunar.month}${lunar.isLeap ? 'n' : ''}/${lunar.year}`;
    if (actual !== expected) errors.push(`${day}/${month}/${year}: cần ${expected}, tính ra ${actual}`);
  }
  return errors;
}
