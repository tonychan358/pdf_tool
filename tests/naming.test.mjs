import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFileName, parseRoster, expandPattern, buildNames } from '../assets/core/naming.mjs';

test('sanitizeFileName：非法字元換底線', () => {
  assert.equal(sanitizeFileName('5A/01:陳大文?'), '5A_01_陳大文_');
  assert.equal(sanitizeFileName('a\\b*c"d<e>f|g'), 'a_b_c_d_e_f_g');
});

test('sanitizeFileName：trim 與空值', () => {
  assert.equal(sanitizeFileName('  李小明  '), '李小明');
  assert.equal(sanitizeFileName('   '), '未命名');
  assert.equal(sanitizeFileName(''), '未命名');
});

test('sanitizeFileName：剝走末尾句點（Windows 唔容許）', () => {
  assert.equal(sanitizeFileName('陳大文...'), '陳大文');
});

test('sanitizeFileName：第二個參數可自訂 fallback（俾識 t() 嘅呼叫方傳已翻譯嘅字）', () => {
  assert.equal(sanitizeFileName('', 'Untitled'), 'Untitled');
  assert.equal(sanitizeFileName('   ', 'Untitled'), 'Untitled');
  assert.equal(sanitizeFileName('...', 'Untitled'), 'Untitled');
});

test('sanitizeFileName：冇傳第二個參數時保持原本嘅中文 fallback（純字串模組唔識 t()，唔可以 import i18n）', () => {
  assert.equal(sanitizeFileName(''), '未命名');
});

test('sanitizeFileName：非空結果唔受 fallback 參數影響', () => {
  assert.equal(sanitizeFileName('陳大文', 'Untitled'), '陳大文');
});

test('parseRoster：逐行 trim、略過空行', () => {
  assert.deepEqual(parseRoster('  陳大文 \n\n 李小明\n\n\n黃三  \n'), ['陳大文', '李小明', '黃三']);
});

test('parseRoster：空輸入回空陣列', () => {
  assert.deepEqual(parseRoster(''), []);
  assert.deepEqual(parseRoster('   \n  \n'), []);
});

test('expandPattern：{n} 依 total 補零', () => {
  assert.equal(expandPattern('功課1_{n}', 0, 21), '功課1_01');
  assert.equal(expandPattern('功課1_{n}', 20, 21), '功課1_21');
  assert.equal(expandPattern('a_{n}', 5, 8), 'a_6');
  assert.equal(expandPattern('a_{n}', 0, 120), 'a_001');
});

test('expandPattern：冇 {n} 就自動喺尾加', () => {
  assert.equal(expandPattern('功課', 0, 9), '功課_1');
});

test('expandPattern：{n} 出現多次全部替換', () => {
  assert.equal(expandPattern('{n}-{n}', 2, 9), '3-3');
});

test('buildNames：名單剛好夠', () => {
  const r = buildNames({ count: 2, roster: ['陳大文', '李小明'], pattern: 'x_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['陳大文.pdf', '李小明.pdf']);
  assert.ok(r.items.every(i => i.source === 'roster' && i.warning === null));
  assert.deepEqual(r.unusedRoster, []);
});

test('buildNames：名單唔夠 → 餘下用 pattern 並標 roster-short', () => {
  const r = buildNames({ count: 3, roster: ['陳大文'], pattern: 'HW_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['陳大文.pdf', 'HW_2.pdf', 'HW_3.pdf']);
  assert.equal(r.items[0].warning, null);
  assert.equal(r.items[1].warning, 'roster-short');
  assert.equal(r.items[2].source, 'pattern');
});

test('buildNames：名單多過份數 → 多餘的入 unusedRoster', () => {
  const r = buildNames({ count: 1, roster: ['甲', '乙', '丙'], pattern: 'x_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['甲.pdf']);
  assert.deepEqual(r.unusedRoster, ['乙', '丙']);
});

test('buildNames：冇名單 → 全部 pattern，唔標 warning', () => {
  const r = buildNames({ count: 2, roster: [], pattern: 'S5A_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['S5A_1.pdf', 'S5A_2.pdf']);
  assert.ok(r.items.every(i => i.source === 'pattern' && i.warning === null));
});

test('buildNames：冇名單亦冇 pattern → 用預設 未命名_{n}', () => {
  const r = buildNames({ count: 2, roster: [], pattern: '' });
  assert.deepEqual(r.items.map(i => i.name), ['未命名_1.pdf', '未命名_2.pdf']);
});

test('buildNames：同名學生自動去重並標 duplicate', () => {
  const r = buildNames({ count: 3, roster: ['陳大文', '陳大文', '陳大文'], pattern: 'x_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['陳大文.pdf', '陳大文_2.pdf', '陳大文_3.pdf']);
  assert.equal(r.items[0].warning, null);
  assert.equal(r.items[1].warning, 'duplicate');
  assert.equal(r.items[2].warning, 'duplicate');
});

test('buildNames：名單含非法字元一併 sanitize', () => {
  const r = buildNames({ count: 1, roster: ['5A/01 陳大文'], pattern: 'x_{n}' });
  assert.equal(r.items[0].name, '5A_01 陳大文.pdf');
});

test('buildNames：count 非正整數拋錯', () => {
  assert.throws(() => buildNames({ count: 0, roster: [], pattern: 'x' }), /份數/);
});

test('buildNames：去重須檢查最終名單（唔只係 base），避免衝突 — 手工消歧 case', () => {
  const r = buildNames({ count: 3, roster: ['甲', '甲', '甲_2'], pattern: 'x_{n}' });
  const names = r.items.map(i => i.name);
  // 衝突時加尾碼直至唯一（甲 → 甲_2 已有 → 甲_2_2）
  assert.deepEqual(names, ['甲.pdf', '甲_2.pdf', '甲_2_2.pdf']);
  assert.equal(r.items[0].warning, null, '無衝突');
  assert.equal(r.items[1].warning, 'duplicate', '衝突');
  assert.equal(r.items[2].warning, 'duplicate', '衝突');
});

test('buildNames：不可有任何重複嘅檔名（invariant）', () => {
  const r = buildNames({ count: 5, roster: ['王小明', '王小明_2', '王小明', '甲', '甲_2'], pattern: 'x_{n}' });
  const names = r.items.map(i => i.name);
  const uniqueNames = new Set(names);
  assert.equal(uniqueNames.size, names.length, `檔名應全部唯一；實際有重複。names=${JSON.stringify(names)}`);
});

test('buildNames：名單項帶尾碼但無衝突 — 尾碼不應被剝走', () => {
  const r = buildNames({ count: 1, roster: ['王小明_2'], pattern: 'x_{n}' });
  assert.equal(r.items[0].name, '王小明_2.pdf', '明確指定嘅尾碼應保留');
  assert.equal(r.items[0].warning, null, '無衝突故警告應為 null');
});

test('buildNames：名單有兩項（其中一項帶尾碼，但兩項不同） — 皆應保留，無假衝突警告', () => {
  const r = buildNames({ count: 2, roster: ['王小明', '王小明_2'], pattern: 'x_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['王小明.pdf', '王小明_2.pdf']);
  assert.equal(r.items[0].warning, null, '第一項無衝突');
  assert.equal(r.items[1].warning, null, '第二項亦無衝突');
});

test('formatSize：B／KB／MB', async () => {
  const { formatSize } = await import('../assets/core/naming.mjs');
  assert.equal(formatSize(500), '500 B');
  assert.equal(formatSize(2048), '2.0 KB');
  assert.equal(formatSize(5 * 1024 * 1024), '5.00 MB');
});
