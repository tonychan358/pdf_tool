import test from 'node:test';
import assert from 'node:assert/strict';
import { interleave } from '../assets/core/paging.mjs';

const flat = r => r.map(x => `${x.stack[0]}${x.index}`).join(' ');

test('interleave：正常 3+3，背面倒序（整疊反轉掃描）', () => {
  // 正面 [p1,p3,p5] index 0,1,2；背面掃出 [p6,p4,p2] index 0,1,2
  // 正確輸出：p1 p2 p3 p4 p5 p6 = f0 b2 f1 b1 f2 b0
  assert.equal(flat(interleave(3, 3, true)), 'f0 b2 f1 b1 f2 b0');
});

test('interleave：正常 3+3，背面順序（逐張翻面掃描）', () => {
  assert.equal(flat(interleave(3, 3, false)), 'f0 b0 f1 b1 f2 b2');
});

test('interleave：最後一頁單面（正面多一張）', () => {
  // 5 頁文件：正面 [p1,p3,p5]，背面 [p4,p2] 倒序
  assert.equal(flat(interleave(3, 2, true)), 'f0 b1 f1 b0 f2');
});

test('interleave：背面多過正面 → 多出的排喺最尾', () => {
  assert.equal(flat(interleave(2, 3, false)), 'f0 b0 f1 b1 b2');
});

test('interleave：其中一疊為空', () => {
  assert.equal(flat(interleave(3, 0, true)), 'f0 f1 f2');
  assert.equal(flat(interleave(0, 2, false)), 'b0 b1');
});

test('interleave：兩疊都空 → 空陣列', () => {
  assert.deepEqual(interleave(0, 0, true), []);
});

test('interleave：非法輸入拋錯', () => {
  assert.throws(() => interleave(-1, 2, true), /頁數/);
  assert.throws(() => interleave(1.5, 2, true), /頁數/);
});

test('interleave：非法輸入的 Error 附有機讀 code', () => {
  assert.throws(() => interleave(-1, 2, true), (e) => e.code === 'INTERLEAVE_COUNT_INVALID');
});
