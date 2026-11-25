// ui.js — Các "viên gạch" giao diện dùng chung cho mọi màn hình.

import { S } from './strings.js';

// Tạo một phần tử HTML. Ví dụ: el('p', { class: 'note' }, 'Xin chào')
// Chữ luôn được đưa vào dạng văn bản thuần (không phải HTML) nên an toàn.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined));
  return node;
}

export function button(label, { variant = 'secondary', onclick, ...rest } = {}) {
  return el('button', { type: 'button', class: `btn btn-${variant}`, onclick, ...rest }, label);
}

export function pageTitle(text) {
  // tabindex -1: để khi chuyển màn hình, máy đọc màn hình đọc tiêu đề trước.
  return el('h1', { class: 'page-title', tabindex: '-1' }, text);
}

export function card(heading, ...children) {
  return el('section', { class: 'card' },
    heading ? el('h2', { class: 'card-title' }, heading) : null,
    ...children);
}

export function comingSoon(title, stage) {
  return [
    pageTitle(title),
    card(null,
      el('p', {}, S.common.comingSoon),
      el('p', { class: 'muted' }, S.common.comingSoonStage(stage))),
  ];
}

// Một dòng trong danh sách mục: bấm vào thì mở trang khác.
export function menuLink({ href, label, note }) {
  return el('a', { class: 'menu-link', href },
    el('span', { class: 'menu-text' },
      el('span', { class: 'menu-label' }, label),
      note ? el('span', { class: 'menu-note' }, note) : null),
    el('span', { class: 'menu-arrow', 'aria-hidden': 'true' }, '›'));
}

// Nhóm lựa chọn "chọn một". options: [{ value, label, hint, note }]
// hint: trong ngoặc, cùng dòng; note: dòng giải thích ở dưới.
// inline: xếp các lựa chọn cạnh nhau thay vì mỗi dòng một lựa chọn.
export function choiceGroup({ name, label, options, value, onchange, inline = false }) {
  const className = inline ? 'choices choices-inline' : 'choices';
  const node = el('div', { class: className, role: 'radiogroup', 'aria-label': label },
    options.map((option) => {
      const input = el('input', {
        type: 'radio', name, value: option.value, checked: option.value === value,
        onchange: () => onchange(option.value),
      });
      return el('label', { class: 'choice' },
        input,
        el('span', { class: 'choice-label' },
          option.label,
          option.hint ? el('span', { class: 'muted' }, ` (${option.hint})`) : null,
          option.note ? el('span', { class: 'choice-note' }, option.note) : null));
    }));
  // Đổi lựa chọn từ bên ngoài (không gọi onchange).
  node.setValue = (newValue) => {
    for (const input of node.querySelectorAll('input')) input.checked = input.value === newValue;
  };
  return node;
}

// Ô nhập số. Nhập sai hoặc quá giới hạn thì tự sửa về giá trị hợp lệ.
// step: 1 = số nguyên, 0.1 = cho phép một số lẻ. unit: chữ đứng sau ô (ví dụ "giây").
export function numberField({ label, value, min, max, step = 1, unit = null, onchange }) {
  let current = value;
  const input = el('input', {
    class: unit ? 'field field-short' : 'field', type: 'number', inputmode: step < 1 ? 'decimal' : 'numeric', min, max, step, value,
    onchange: () => {
      const typed = Number((Math.round(Number(input.value) / step) * step).toFixed(2));
      if (input.value !== '' && Number.isFinite(typed)) current = Math.min(max, Math.max(min, typed));
      input.value = current;
      onchange(current);
    },
  });
  const node = el('label', { class: 'field-row' },
    el('span', {}, label), input, unit ? el('span', {}, unit) : null);
  node.getValue = () => current;
  // Đổi số từ bên ngoài (không gọi onchange).
  node.setValue = (newValue) => {
    current = newValue;
    input.value = newValue;
  };
  return node;
}

export function timeField({ label, value, onchange }) {
  const input = el('input', {
    class: 'field', type: 'time', value,
    onchange: () => {
      if (input.value) onchange(input.value.slice(0, 5));
    },
  });
  return el('label', { class: 'field-row' }, el('span', {}, label), input);
}

export function toggle({ label, checked, onchange }) {
  const input = el('input', {
    type: 'checkbox', checked, onchange: () => onchange(input.checked),
  });
  return el('label', { class: 'choice' }, input, el('span', { class: 'choice-label' }, label));
}

// ---------------------------------------------------------------------------
// Biểu tượng nét đơn giản
// ---------------------------------------------------------------------------

const ICONS = {
  today: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'],
  counter: ['M12 19c-3-1.5-4.5-4.500-4.500-7.500S9.500 6 12 4c2.500 2 4.500 4.500 4.500 7.500S15 17.500 12 19z', 'M7.600 10C5.500 9.500 3.500 9.700 2 10.500c.5 4.500 4.500 8 10 8.500 5.500-.5 9.500-4 10-8.500-1.500-.8-3.500-1-5.600-.5'],
  schedule: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3.500 2'],
  lessons: ['M12 6C10 4.500 7 4 3 4v14c4 0 7 .5 9 2 2-1.500 5-2 9-2V4c-4 0-7 .5-9 2z', 'M12 6v14'],
  calendar: ['M4 5h16v16H4z', 'M4 10h16M8 2.500V7M16 2.500V7'],
  settings: ['M4 7h9M19 7h1M4 17h1M11 17h9', 'M16 4.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5zM8 14.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5z'],
};

export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Thông báo ngắn và hộp hỏi xác nhận
// ---------------------------------------------------------------------------

let toastTimer = null;

export function toast(message) {
  const box = document.getElementById('toast');
  clearTimeout(toastTimer);
  box.textContent = message;
  box.classList.add('show');
  toastTimer = setTimeout(() => {
    box.classList.remove('show');
    box.textContent = '';
  }, 5000);
}

// Trả về Promise: true nếu người dùng đồng ý, false nếu không.
export function confirmDialog({ title, message, yes }) {
  if (typeof HTMLDialogElement === 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`)); // Máy quá cũ
  }
  return new Promise((resolve) => {
    let answer = false;
    const close = (value) => { answer = value; dialog.close(); };
    const dialog = el('dialog', {
      class: 'dialog', 'aria-labelledby': 'dialog-title',
      onclose: () => { dialog.remove(); resolve(answer); },
    },
      el('h2', { id: 'dialog-title', class: 'card-title' }, title),
      el('p', {}, message),
      el('div', { class: 'stack' },
        // Nút "Không" đứng trước để khó bấm nhầm.
        button(S.common.cancel, { variant: 'primary', onclick: () => close(false) }),
        button(yes, { variant: 'danger', onclick: () => close(true) })));
    document.body.append(dialog);
    dialog.showModal();
  });
}

// ---------------------------------------------------------------------------
// Áp dụng cỡ chữ và màu nền
// ---------------------------------------------------------------------------

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

export function applyAppearance(settings) {
  const root = document.documentElement;
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && prefersDark.matches);
  root.style.fontSize = `${settings.fontSize}px`;
  root.dataset.theme = dark ? 'dark' : 'light';
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]').content = background;
}

export function onSystemThemeChange(callback) {
  prefersDark.addEventListener?.('change', callback);
}
