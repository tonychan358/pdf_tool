// 純字串模組：不得 import 任何嘢、不得掂 DOM 或 pdf-lib。

const ILLEGAL = /[\\/:*?"<>|]/g;
const DEFAULT_PATTERN = '未命名_{n}';

// fallback 有預設值 '未命名'，等呢個模組獨自被叫（或者舊測試冇傳第二個
// 參數）都照舊得返中文——但呢個模組本身唔可以 import i18n.mjs（純字串模組
// 嘅規矩，見檔頂），淨係識呢一個寫死嘅中文字。想要英文 UI 落嘅英文檔名，
// 就要由識得 t() 嘅呼叫方（各 tools/*.html）自己傳返個已經翻譯好嘅字入嚟。
export function sanitizeFileName(name, fallback = '未命名') {
  let s = String(name ?? '').replace(ILLEGAL, '_').trim();
  s = s.replace(/\.+$/, '').trim();   // Windows 唔容許檔名以句點結尾
  return s === '' ? fallback : s;
}

export function parseRoster(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '');
}

export function expandPattern(pattern, index, total) {
  const width = String(Math.max(total, 1)).length;
  const num = String(index + 1).padStart(width, '0');
  const p = String(pattern ?? '');
  return p.includes('{n}') ? p.replaceAll('{n}', num) : `${p}_${num}`;
}

export function buildNames({ count, roster = [], pattern = '' }) {
  if (!Number.isInteger(count) || count < 1) throw new Error('份數必須為正整數');
  const effectivePattern = String(pattern).trim() === '' ? DEFAULT_PATTERN : pattern;
  const emitted = new Set();    // 追蹤已發出嘅最終名單
  const items = [];

  for (let i = 0; i < count; i++) {
    const fromRoster = i < roster.length;
    let candidate = sanitizeFileName(
      fromRoster ? roster[i] : expandPattern(effectivePattern, i, count)
    );
    let warning = fromRoster ? null : (roster.length > 0 ? 'roster-short' : null);

    // 處理衝突：若 candidate 已發出，加尾碼直至找到唯一項
    if (emitted.has(candidate)) {
      let n = 2;
      while (emitted.has(`${candidate}_${n}`)) {
        n++;
      }
      candidate = `${candidate}_${n}`;
      warning = 'duplicate';
    }

    emitted.add(candidate);
    items.push({ name: `${candidate}.pdf`, source: fromRoster ? 'roster' : 'pattern', warning });
  }

  return { items, unusedRoster: roster.slice(count) };
}

// 位元組 → 「12.3 KB」／「4.56 MB」
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
