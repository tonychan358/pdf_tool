import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByCount, parseRanges, eachPage } from '../assets/core/paging.mjs';

test('groupByCount：整除', () => {
  assert.deepEqual(groupByCount(8, 4), [{ start: 1, end: 4 }, { start: 5, end: 8 }]);
});

test('groupByCount：唔整除，最後一組唔夠數', () => {
  const g = groupByCount(33, 4);
  assert.equal(g.length, 9);
  assert.deepEqual(g[8], { start: 33, end: 33 });
});

test('groupByCount：84 頁每 4 頁 → 21 組', () => {
  assert.equal(groupByCount(84, 4).length, 21);
});

test('groupByCount：n 大過總頁數 → 一組包晒', () => {
  assert.deepEqual(groupByCount(3, 10), [{ start: 1, end: 3 }]);
});

test('groupByCount：非法輸入拋錯', () => {
  assert.throws(() => groupByCount(10, 0), /每份頁數/);
  assert.throws(() => groupByCount(10, -1), /每份頁數/);
  assert.throws(() => groupByCount(10, 1.5), /每份頁數/);
  assert.throws(() => groupByCount(0, 4), /總頁數/);
});

test('groupByCount：非法輸入的 Error 附有機讀 code', () => {
  assert.throws(() => groupByCount(10, 0), (e) => e.code === 'EVERY_N_INVALID');
  assert.throws(() => groupByCount(0, 4), (e) => e.code === 'TOTAL_PAGES_INVALID');
});

test('parseRanges：基本', () => {
  assert.deepEqual(parseRanges('1-3,4-8', 10), [{ start: 1, end: 3 }, { start: 4, end: 8 }]);
});

test('parseRanges：單頁、空白、全形逗號都食', () => {
  assert.deepEqual(parseRanges(' 1 , 5-6 ，9 ', 10),
    [{ start: 1, end: 1 }, { start: 5, end: 6 }, { start: 9, end: 9 }]);
});

test('parseRanges：全形／排版用連接號（－–—）都當半形減號處理', () => {
  assert.deepEqual(parseRanges('1－3,4–8,9—12', 20),
    [{ start: 1, end: 3 }, { start: 4, end: 8 }, { start: 9, end: 12 }]);
});

test('parseRanges：容許重疊（用戶可能刻意）', () => {
  assert.deepEqual(parseRanges('1-3,2-4', 10), [{ start: 1, end: 3 }, { start: 2, end: 4 }]);
});

test('parseRanges：越界拋錯', () => {
  assert.throws(() => parseRanges('1-20', 10), /超出/);
  assert.throws(() => parseRanges('0-3', 10), /超出/);
});

test('parseRanges：倒轉範圍拋錯', () => {
  assert.throws(() => parseRanges('8-3', 10), /起始頁/);
});

test('parseRanges：空字串拋錯', () => {
  assert.throws(() => parseRanges('   ', 10), /請輸入/);
});

test('parseRanges：各種非法輸入嘅 Error 都附有機讀 code（俾 UI 層做 i18n 映射）', () => {
  assert.throws(() => parseRanges('1-20', 10), (e) => e.code === 'RANGE_OUT_OF_BOUNDS' && e.part === '1-20' && e.totalPages === 10);
  assert.throws(() => parseRanges('8-3', 10), (e) => e.code === 'RANGE_REVERSED' && e.part === '8-3');
  assert.throws(() => parseRanges('abc', 10), (e) => e.code === 'RANGE_UNPARSEABLE' && e.part === 'abc');
  assert.throws(() => parseRanges('   ', 10), (e) => e.code === 'RANGES_EMPTY');
  assert.throws(() => parseRanges('1-3', 0), (e) => e.code === 'TOTAL_PAGES_INVALID');
});

test('eachPage', () => {
  assert.deepEqual(eachPage(3), [{ start: 1, end: 1 }, { start: 2, end: 2 }, { start: 3, end: 3 }]);
});
