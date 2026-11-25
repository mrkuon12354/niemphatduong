// storage.js — LỚP LƯU TRỮ. Mọi việc đọc/ghi dữ liệu đều phải đi qua file này.
// Không file nào khác được gọi trực tiếp IndexedDB hay localStorage.
//
// Bên trong có 3 "kho", thử lần lượt từ trên xuống:
//   1. IndexedDB    — kho chính, chứa được nhiều.
//   2. localStorage — dự phòng khi IndexedDB không mở được.
//   3. Bộ nhớ tạm   — khi trình duyệt cấm lưu; dữ liệu mất khi đóng app.
// Cả 3 kho có cùng các hàm get / getAll / write, nên phần còn lại của file
// không cần biết đang dùng kho nào. Sau này đồng bộ lên máy chủ thì thêm ở đây.

import { APP_ID, APP_VERSION, DEFAULT_SETTINGS, SETTING_RULES } from './config.js';
import { toLocalIso, dateKeyOfIso } from './dates.js';

// Tăng số này khi đổi cấu trúc dữ liệu, và thêm một bước vào MIGRATIONS.
export const SCHEMA_VERSION = 1;

// kv: các bản ghi đơn lẻ (thông tin máy, cài đặt). Còn lại: danh sách bản ghi.
const STORES = ['kv', 'sessions', 'lessonProgress'];
const SESSION_TYPES = ['free', 'morning', 'evening', 'thapniem'];

// ---------------------------------------------------------------------------
// KHO 1: IndexedDB
// ---------------------------------------------------------------------------

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    let gaveUp = false;
    // Có máy mở IndexedDB bị treo: chờ 4 giây rồi dùng phương án dự phòng.
    const timer = setTimeout(() => {
      gaveUp = true;
      reject(new Error('IndexedDB timeout'));
    }, 4000);

    const request = indexedDB.open(APP_ID, 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      const db = request.result;
      if (gaveUp) return db.close();
      db.onversionchange = () => db.close();
      resolve(createIndexedDbBackend(db));
    };
  });
}

function createIndexedDbBackend(db) {
  const read = (store, makeRequest) =>
    new Promise((resolve, reject) => {
      const request = makeRequest(db.transaction(store).objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  return {
    mode: 'indexeddb',
    get: (store, id) => read(store, (s) => s.get(id)),
    getAll: (store) => read(store, (s) => s.getAll()),
    // Ghi nhiều việc trong MỘT giao dịch: hoặc xong tất cả, hoặc không đổi gì.
    write: (ops) =>
      new Promise((resolve, reject) => {
        if (ops.length === 0) return resolve();
        const tx = db.transaction(STORES, 'readwrite');
        for (const op of ops) {
          const store = tx.objectStore(op.store);
          if (op.clear) store.clear();
          else store.put(op.put);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  };
}

// ---------------------------------------------------------------------------
// KHO 2 và 3: localStorage, bộ nhớ tạm
// ---------------------------------------------------------------------------

function createSimpleBackend(mode, readStore, writeStore) {
  return {
    mode,
    get: async (store, id) => readStore(store)[id],
    getAll: async (store) => Object.values(readStore(store)),
    write: async (ops) => {
      const changed = {};
      for (const op of ops) {
        changed[op.store] ??= { ...readStore(op.store) };
        if (op.clear) changed[op.store] = {};
        else changed[op.store][op.put.id] = op.put;
      }
      for (const [store, data] of Object.entries(changed)) writeStore(store, data);
    },
  };
}

const localKey = (store) => `${APP_ID}:${store}`;

function createLocalStorageBackend() {
  // Ghi thử một lần: nếu bị cấm thì báo lỗi ngay để dùng kho 3.
  localStorage.setItem(`${APP_ID}:test`, '1');
  localStorage.removeItem(`${APP_ID}:test`);
  return createSimpleBackend(
    'localstorage',
    (store) => JSON.parse(localStorage.getItem(localKey(store)) ?? '{}'),
    (store, data) => localStorage.setItem(localKey(store), JSON.stringify(data)),
  );
}

function createMemoryBackend() {
  const memory = {};
  return createSimpleBackend(
    'memory',
    (store) => memory[store] ?? {},
    (store, data) => { memory[store] = data; },
  );
}

async function openBackend() {
  try {
    const db = await openIndexedDb();
    await moveFallbackData(db);
    return db;
  } catch (error) {
    console.warn('Không mở được IndexedDB, dùng localStorage.', error);
  }
  try {
    return createLocalStorageBackend();
  } catch (error) {
    console.warn('Không dùng được localStorage, dữ liệu chỉ lưu tạm.', error);
    return createMemoryBackend();
  }
}

// Nếu có lần phải dùng tạm localStorage, lần này IndexedDB mở được
// thì chuyển dữ liệu đó về kho chính, để người dùng không bị mất.
async function moveFallbackData(db) {
  try {
    const fallback = createLocalStorageBackend();
    const ops = [];
    for (const store of STORES) {
      const records = await fallback.getAll(store);
      for (const record of records) {
        const existing = await db.get(store, record.id);
        // Thông tin máy (meta) ở kho chính luôn được giữ nguyên.
        const isOwnMeta = store === 'kv' && record.id === 'meta' && existing;
        if (!isOwnMeta && isNewer(record, existing)) ops.push({ store, put: record });
      }
    }
    await db.write(ops);
    for (const store of STORES) localStorage.removeItem(localKey(store));
  } catch (error) {
    console.warn('Chưa chuyển được dữ liệu dự phòng.', error);
  }
}

// ---------------------------------------------------------------------------
// Khởi động và chuyển đổi dữ liệu cũ (migrate)
// ---------------------------------------------------------------------------

// Mỗi bước nhận dữ liệu bản N và trả về dữ liệu bản N+1. Ví dụ sau này:
//   1: (data) => ({ ...data, sessions: data.sessions.map((s) => ({ ...s, note: '' })) }),
const MIGRATIONS = {};

// data có dạng { schemaVersion, settings, sessions, lessonProgress }
export function migrate(data) {
  let current = data;
  while (current.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) throw new Error(`Thiếu bước migrate từ bản ${current.schemaVersion}`);
    current = { ...step(current), schemaVersion: current.schemaVersion + 1 };
  }
  return current;
}

let readyPromise = null;

// Mở kho một lần duy nhất; các lần gọi sau dùng lại kết quả.
export function initStorage() {
  readyPromise ??= prepare();
  return readyPromise;
}

async function prepare() {
  const db = await openBackend();
  const meta = await db.get('kv', 'meta');
  if (!meta) {
    await db.write([{ store: 'kv', put: newMeta() }]);
  } else if (meta.schemaVersion < SCHEMA_VERSION) {
    const migrated = migrate({
      schemaVersion: meta.schemaVersion,
      settings: await db.get('kv', 'settings'),
      sessions: await db.getAll('sessions'),
      lessonProgress: await db.getAll('lessonProgress'),
    });
    await db.write([
      ...(migrated.settings ? [{ store: 'kv', put: migrated.settings }] : []),
      { store: 'sessions', clear: true },
      ...migrated.sessions.map((put) => ({ store: 'sessions', put })),
      { store: 'lessonProgress', clear: true },
      ...migrated.lessonProgress.map((put) => ({ store: 'lessonProgress', put })),
      { store: 'kv', put: { ...meta, schemaVersion: SCHEMA_VERSION, updatedAt: toLocalIso() } },
    ]);
  }
  return db;
}

// deviceId là mã ngẫu nhiên, không chứa thông tin gì về người dùng.
function newMeta() {
  const now = toLocalIso();
  return {
    id: 'meta',
    schemaVersion: SCHEMA_VERSION,
    deviceId: newId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Dự phòng: randomUUID chỉ có trên https hoặc localhost.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

function isNewer(record, existing) {
  return !existing || Date.parse(record.updatedAt) > Date.parse(existing.updatedAt);
}

// Cho giao diện biết đang lưu kiểu gì: 'indexeddb' | 'localstorage' | 'memory'
export async function getStorageMode() {
  return (await initStorage()).mode;
}

export async function getDeviceId() {
  const db = await initStorage();
  return (await db.get('kv', 'meta')).deviceId;
}

// ---------------------------------------------------------------------------
// Cài đặt
// ---------------------------------------------------------------------------

function cleanSettings(values = {}) {
  const result = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    result[key] = SETTING_RULES[key](values[key]) ? values[key] : fallback;
  }
  return result;
}

export async function getSettings() {
  const db = await initStorage();
  return cleanSettings((await db.get('kv', 'settings'))?.values);
}

// Các việc "đọc rồi ghi lại" phải xếp hàng, để hai lần bấm nhanh không đè mất nhau.
let writeQueue = Promise.resolve();
function enqueue(task) {
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => {});
  return result;
}

// Chỉ cần truyền phần muốn đổi, ví dụ saveSettings({ fontSize: 22 })
export function saveSettings(patch) {
  return enqueue(async () => {
    const db = await initStorage();
    const old = await db.get('kv', 'settings');
    const now = toLocalIso();
    const values = cleanSettings({ ...old?.values, ...patch });
    await db.write([{
      store: 'kv',
      put: { id: 'settings', values, createdAt: old?.createdAt ?? now, updatedAt: now },
    }]);
    return values;
  });
}

// ---------------------------------------------------------------------------
// Thời niệm (sessions)
// Không lưu "tổng số câu". Tổng luôn được CỘNG LẠI từ các bản ghi, để sau này
// đồng bộ nhiều máy không bị cộng trùng.
// ---------------------------------------------------------------------------

function isValidTime(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

const isCount = (n) => Number.isSafeInteger(n) && n >= 0;

function isValidSession(s) {
  return (
    s !== null && typeof s === 'object' &&
    typeof s.id === 'string' && s.id !== '' &&
    typeof s.deviceId === 'string' &&
    typeof s.phrase === 'string' &&
    [s.startedAt, s.endedAt, s.createdAt, s.updatedAt].every(isValidTime) &&
    isCount(s.count) && isCount(s.durationSec) &&
    SESSION_TYPES.includes(s.type) &&
    (s.slot === undefined || typeof s.slot === 'string') &&
    (s.deletedAt === undefined || isValidTime(s.deletedAt))
  );
}

function isValidProgress(p) {
  return (
    p !== null && typeof p === 'object' &&
    typeof p.id === 'string' && p.id !== '' &&
    typeof p.lessonId === 'string' &&
    [p.createdAt, p.updatedAt].every(isValidTime) &&
    (p.deletedAt === undefined || isValidTime(p.deletedAt))
  );
}

// Thêm một thời niệm mới.
// session: { startedAt, endedAt, phrase, count, durationSec, type, slot? }
export function addSession(session) {
  return saveSession({ ...session, id: newId() });
}

// Lưu một thời niệm theo id: chưa có thì thêm, có rồi thì cập nhật.
// Nhờ vậy thời đang niệm được lưu dần, máy tắt đột ngột cũng không mất.
export function saveSession(session) {
  return enqueue(async () => {
    const db = await initStorage();
    const old = await db.get('sessions', session.id);
    const now = toLocalIso();
    const record = {
      id: session.id,
      deviceId: old?.deviceId ?? (await getDeviceId()),
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      phrase: session.phrase,
      count: session.count,
      durationSec: session.durationSec,
      type: session.type,
      // Chỉ thập niệm mới có slot (lần nào trong ngày).
      ...(session.slot ? { slot: session.slot } : {}),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    if (!isValidSession(record)) throw new Error('Thời niệm không hợp lệ');
    await db.write([{ store: 'sessions', put: record }]);
    return record;
  });
}

// Bỏ một thời niệm: chỉ đánh dấu deletedAt chứ không xóa hẳn,
// để sau này đồng bộ thì các máy khác cũng biết là đã bỏ.
export function deleteSession(id) {
  return enqueue(async () => {
    const db = await initStorage();
    const old = await db.get('sessions', id);
    if (!old) return;
    const now = toLocalIso();
    await db.write([{ store: 'sessions', put: { ...old, deletedAt: now, updatedAt: now } }]);
  });
}

export async function getSessions() {
  const db = await initStorage();
  await writeQueue; // Chờ ghi xong những việc đang xếp hàng
  const sessions = (await db.getAll('sessions')).filter((s) => !s.deletedAt);
  return sessions.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

// Các thời niệm của một ngày, ví dụ getSessionsOfDate('2026-11-25')
export async function getSessionsOfDate(dateKey) {
  return (await getSessions()).filter((s) => dateKeyOfIso(s.startedAt) === dateKey);
}

// Tổng số câu của một ngày. exceptId: bỏ qua thời niệm này (thời đang đếm dở).
export async function getCountOfDate(dateKey, { exceptId } = {}) {
  return (await getSessionsOfDate(dateKey))
    .filter((s) => s.id !== exceptId)
    .reduce((sum, s) => sum + s.count, 0);
}

// Tổng số câu của từng ngày có niệm: Map { '2026-11-25' → 324, ... }
export async function getCountsByDate() {
  const totals = new Map();
  for (const session of await getSessions()) {
    const key = dateKeyOfIso(session.startedAt);
    totals.set(key, (totals.get(key) ?? 0) + session.count);
  }
  return totals;
}

// Xin trình duyệt đừng tự dọn dữ liệu của app khi máy đầy.
export async function requestPersistence() {
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Trình duyệt không hỗ trợ: bỏ qua.
  }
}

// ---------------------------------------------------------------------------
// Tiến độ bài học. id của bản ghi chính là id bài học, nên gộp dữ liệu nhiều máy
// thì mỗi bài vẫn chỉ có một bản ghi.
// ---------------------------------------------------------------------------

// Các bài đã học: Map { 'hoi-huong' → thời điểm bấm "Đã học", ... }
export async function getLearnedLessons() {
  const db = await initStorage();
  await writeQueue;
  const records = (await db.getAll('lessonProgress')).filter((p) => !p.deletedAt);
  return new Map(records.map((p) => [p.lessonId, p.updatedAt]));
}

// Đánh dấu đã học (true) hoặc chưa học (false).
export function setLessonLearned(lessonId, learned) {
  return enqueue(async () => {
    const db = await initStorage();
    const old = await db.get('lessonProgress', lessonId);
    if (!old && !learned) return;
    const now = toLocalIso();
    await db.write([{
      store: 'lessonProgress',
      put: {
        id: lessonId,
        lessonId,
        deviceId: old?.deviceId ?? (await getDeviceId()),
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        ...(learned ? {} : { deletedAt: now }),
      },
    }]);
  });
}

// ---------------------------------------------------------------------------
// Nhật ký nhắc giờ: nhớ lần nhắc gần nhất, để không nhắc lại nhiều lần.
// ---------------------------------------------------------------------------

export async function getReminderLog() {
  const db = await initStorage();
  return (await db.get('kv', 'reminderLog'))?.values ?? {};
}

export function saveReminderLog(patch) {
  return enqueue(async () => {
    const db = await initStorage();
    const old = await db.get('kv', 'reminderLog');
    const now = toLocalIso();
    await db.write([{
      store: 'kv',
      put: {
        id: 'reminderLog', values: { ...old?.values, ...patch },
        createdAt: old?.createdAt ?? now, updatedAt: now,
      },
    }]);
  });
}

// ---------------------------------------------------------------------------
// Sao lưu, khôi phục, xóa
// ---------------------------------------------------------------------------

export async function exportAll() {
  const db = await initStorage();
  await writeQueue;
  return {
    app: APP_ID,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: toLocalIso(),
    settings: (await db.get('kv', 'settings')) ?? null,
    sessions: await db.getAll('sessions'),
    lessonProgress: await db.getAll('lessonProgress'),
  };
}

export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // 'bad-json' | 'not-backup' | 'too-new'
  }
}

// GỘP dữ liệu trong file vào máy: bản ghi trùng id thì giữ bản mới hơn.
// Khôi phục cùng một file nhiều lần cũng không bị cộng trùng số câu.
export function importAll(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new BackupError('bad-json');
  }
  const isBackup =
    data?.app === APP_ID &&
    Number.isInteger(data.schemaVersion) &&
    data.schemaVersion >= 1 &&
    Array.isArray(data.sessions) &&
    Array.isArray(data.lessonProgress);
  if (!isBackup) throw new BackupError('not-backup');
  if (data.schemaVersion > SCHEMA_VERSION) throw new BackupError('too-new');
  const migrated = migrate(data);

  return enqueue(async () => {
    const db = await initStorage();
    const ops = [];
    let added = 0;
    let skipped = 0;

    const checks = { sessions: isValidSession, lessonProgress: isValidProgress };
    for (const [store, isValid] of Object.entries(checks)) {
      const known = new Map((await db.getAll(store)).map((r) => [r.id, r]));
      for (const record of migrated[store]) {
        if (!isValid(record)) {
          skipped += 1;
          continue;
        }
        const existing = known.get(record.id);
        if (!isNewer(record, existing)) continue;
        ops.push({ store, put: record });
        known.set(record.id, record);
        if (store === 'sessions' && !existing && !record.deletedAt) added += 1;
      }
    }

    const incoming = migrated.settings;
    if (incoming?.values && [incoming.createdAt, incoming.updatedAt].every(isValidTime)) {
      const existing = await db.get('kv', 'settings');
      if (isNewer(incoming, existing)) {
        const { createdAt, updatedAt } = incoming;
        const values = cleanSettings(incoming.values);
        ops.push({ store: 'kv', put: { id: 'settings', values, createdAt, updatedAt } });
      }
    }

    await db.write(ops);
    return { added, skipped };
  });
}

// Xóa tất cả, kể cả mã máy cũ; tạo mã máy mới.
export function eraseAll() {
  return enqueue(async () => {
    const db = await initStorage();
    await db.write([
      ...STORES.map((store) => ({ store, clear: true })),
      { store: 'kv', put: newMeta() },
    ]);
  });
}
