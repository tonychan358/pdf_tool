export const HANDOFF_TTL = 60 * 60 * 1000;
const DATABASE = 'pdf-toolbox-handoff';
const STORE = 'results';
const PDF_TOOLS = ['merge', 'split', 'interleave', 'organize', 'nup', 'margin'];
const NEXT_TOOLS = ['margin', 'nup', 'organize'];

export function handoffTargets(currentTool) {
  return NEXT_TOOLS.filter(tool => tool !== currentTool).slice(0, 3);
}

export function isHandoffExpired(record, now = Date.now()) {
  return !Number.isFinite(record?.createdAt) || record.createdAt > now || now - record.createdAt >= HANDOFF_TTL;
}

class HandoffError extends Error {
  constructor(key) { super(key); this.i18nKey = key; }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request, settled = false;
    const fail = () => { settled = true; reject(new Error('IndexedDB unavailable')); };
    const timer = setTimeout(fail, 5000);
    try { request = indexedDB.open(DATABASE, 1); }
    catch (e) { clearTimeout(timer); reject(e); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onerror = () => { clearTimeout(timer); fail(); };
    request.onblocked = () => { clearTimeout(timer); fail(); };
    request.onsuccess = () => {
      clearTimeout(timer);
      const db = request.result;
      if (settled) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

async function transaction(action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      action(tx.objectStore(STORE), value => { result = value; });
    });
  } finally { db.close(); }
}

export async function handoff(bytes, name, targetTool) {
  if (!PDF_TOOLS.includes(targetTool)) throw new HandoffError('handoff.unsupported');
  const id = crypto.randomUUID();
  try {
    await transaction(store => {
      // 同一交易清走過期檔案，避免未開啟的接力一直佔用本機儲存空間。
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        if (isHandoffExpired(entry.value)) entry.delete();
        entry.continue();
      };
      store.put({ id, bytes, name, targetTool, createdAt: Date.now() });
    });
  } catch { throw new HandoffError('handoff.writeFailed'); }
  const url = new URL(`../../tools/${targetTool}.html`, import.meta.url);
  url.searchParams.set('handoff', id);
  location.assign(url.href);
}

export async function consumeHandoff(id, targetTool) {
  let record;
  try {
    record = await transaction((store, done) => {
      const request = store.get(id);
      request.onsuccess = () => {
        // 讀取與刪除必須同一交易，兩個分頁同時開同一連結也只能使用一次。
        done(request.result);
        store.delete(id);
      };
    });
  } catch { throw new HandoffError('handoff.readFailed'); }
  if (!record) throw new HandoffError('handoff.missing');
  if (isHandoffExpired(record)) throw new HandoffError('handoff.expired');
  if (!PDF_TOOLS.includes(targetTool) || record.targetTool !== targetTool) throw new HandoffError('handoff.unsupported');
  if (!(record.bytes instanceof Uint8Array) || !record.bytes.length || typeof record.name !== 'string') throw new HandoffError('handoff.readFailed');
  return new File([record.bytes], record.name, { type: 'application/pdf' });
}

export async function receiveHandoff({ targetTool, accept = 'pdf', inputGuard, onFile, onError, onLoaded }) {
  const url = new URL(location.href);
  const id = url.searchParams.get('handoff');
  if (!id) return;
  url.searchParams.delete('handoff');
  history.replaceState(history.state, '', url);
  await inputGuard.hold(async lease => {
    try {
      const file = await consumeHandoff(id, targetTool);
      if (!inputGuard.allows(lease)) return;
      if (accept !== 'pdf') throw new HandoffError('handoff.unsupported');
      const applied = await onFile(file, lease);
      if (applied !== false && inputGuard.allows(lease)) onLoaded?.(file.name);
    } catch (e) {
      if (inputGuard.allows(lease)) onError(e.i18nKey || 'handoff.readFailed');
    }
  }); // hold() releases in finally, including read/load failures.
}
