// content.js — Đọc nội dung (kệ, thập niệm, bản ghi âm...) từ các file JSON.
// Sau này muốn tải nội dung từ máy chủ thì chỉ cần sửa hàm loadItems().

const cache = new Map();

function loadItems(url) {
  if (!cache.has(url)) {
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Không đọc được ${url}`);
        return response.json();
      })
      .then((data) => data.items);
    // Nếu lỗi thì quên đi, để lần sau thử lại.
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return cache.get(url);
}

async function findItem(url, id) {
  const item = (await loadItems(url)).find((entry) => entry.id === id);
  if (!item) throw new Error(`Thiếu mục "${id}" trong ${url}`);
  return item;
}

export const getVerse = (id) => findItem('content/verses.json', id);
export const getPractice = (id) => findItem('content/practices.json', id);

// Các bản ghi âm thật sự có file. Danh sách trống thì giao diện tự ẩn phần này.
export async function getRecordings() {
  try {
    const items = await loadItems('audio/playlist.json');
    const checked = await Promise.all(items.map(async (item) => {
      const url = `audio/${encodeURIComponent(item.file)}`;
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok ? { ...item, url } : null;
    }));
    return checked.filter(Boolean);
  } catch {
    return [];
  }
}
