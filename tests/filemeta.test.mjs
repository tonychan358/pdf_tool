import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '../vendor/pdf-lib.esm.min.js';
import { readPageCount, getPageCount, summarizeFiles } from '../assets/core/filemeta.mjs';

test('頁數：實際 PDF、空 MIME 副檔名與快取', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage(); pdf.addPage();
  const file = new File([await pdf.save()], 'lesson.PDF');
  assert.equal(await readPageCount(file), 2);
  const first = getPageCount(file);
  assert.equal(first, getPageCount(file));
  assert.equal(await first, 2);
});

test('頁數：非 PDF 不讀取，失敗或無效頁數不阻礙清單', async () => {
  assert.equal(await readPageCount({ name: 'photo.png', type: 'image/png' }, () => assert.fail('不應讀取圖片')), null);
  for (const value of [0, -1, 1.5, undefined]) assert.equal(await readPageCount({ name: 'file.pdf' }, async () => value), null);
  assert.equal(await readPageCount({ name: 'broken.pdf' }, async () => { throw new Error('corrupt'); }), null);
});

test('摘要：完整頁數才顯示總計，不把未知頁數當作零', () => {
  const files = [{ size: 100 }, { size: 300 }];
  assert.deepEqual(summarizeFiles(files, [2, 3]), { count: 2, bytes: 400, pages: 5 });
  assert.deepEqual(summarizeFiles(files, [2, null]), { count: 2, bytes: 400, pages: null });
  assert.deepEqual(summarizeFiles(files, [2]), { count: 2, bytes: 400, pages: null });
  assert.deepEqual(summarizeFiles([], []), { count: 0, bytes: 0, pages: 0 });
});
