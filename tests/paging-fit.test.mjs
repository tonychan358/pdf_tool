import test from 'node:test';
import assert from 'node:assert/strict';
import { fitInto } from '../assets/core/paging.mjs';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

test('fitInto：闊度受限（來源比框更闊）', () => {
  const r = fitInto({ srcW: 200, srcH: 100, boxW: 100, boxH: 100 });
  near(r.scale, 0.5); near(r.w, 100); near(r.h, 50);
  near(r.x, 0); near(r.y, 25);
});

test('fitInto：高度受限', () => {
  const r = fitInto({ srcW: 100, srcH: 200, boxW: 100, boxH: 100 });
  near(r.scale, 0.5); near(r.w, 50); near(r.h, 100);
  near(r.x, 25); near(r.y, 0);
});

test('fitInto：細過個框亦會放大填滿', () => {
  const r = fitInto({ srcW: 50, srcH: 50, boxW: 100, boxH: 100 });
  near(r.scale, 2); near(r.w, 100); near(r.h, 100);
});

test('fitInto：非法輸入拋錯', () => {
  assert.throws(() => fitInto({ srcW: 0, srcH: 10, boxW: 10, boxH: 10 }), /尺寸/);
  assert.throws(() => fitInto({ srcW: 10, srcH: 10, boxW: -1, boxH: 10 }), /尺寸/);
});
