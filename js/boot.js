// boot.js — Chạy trước mọi thứ khác, để vừa mở hay tải lại trang là đúng ngay màu nền và cỡ chữ
// người dùng đã chọn, không bị chớp sáng rồi mới tối.
//
// Kho chính (IndexedDB) đọc chậm hơn một chút, nên storage.js ghi sẵn một bản sao nhỏ
// { theme, fontSize } vào localStorage. File này CHỈ ĐỌC bản sao đó.
// Không dùng import/export để trình duyệt chạy ngay, không phải chờ.
(function () {
  try {
    var look = JSON.parse(localStorage.getItem('niem-phat-duong:look'));
    if (!look) return;
    var dark = look.theme === 'dark'
      || (look.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (look.fontSize >= 18 && look.fontSize <= 40) {
      document.documentElement.style.fontSize = look.fontSize + 'px';
    }
    document.querySelector('meta[name="theme-color"]').content = dark ? '#17120e' : '#fbf6e9';
  } catch (error) {
    // Không đọc được thì thôi: app.js sẽ đặt lại sau.
  }
})();
