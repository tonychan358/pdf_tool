import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

test('package.json 的 test script 不得帶路徑參數（Node 24 會 MODULE_NOT_FOUND）', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test');
});

test('vendor 檔已就位', () => {
  for (const f of [
    '../vendor/pdf-lib.esm.min.js',
    '../vendor/jszip.min.js',
    '../vendor/pdfjs/pdf.min.mjs',
    '../vendor/pdfjs/pdf.worker.min.mjs',
  ]) {
    assert.ok(existsSync(new URL(f, import.meta.url)), `缺 ${f}`);
  }
});

// cmaps 冧咗唔會令 pdf.js 拋錯——thumbs.mjs 會照樣渲染縮圖，淨係中文字符
// 對唔上位，變成縮圖入面成堆空白格，老師會以為個檔案本身有問題，唔會諗到
// 係 vendor 資源漏咗。呢個 test 唔識喺 Node 入面實際渲染 PDF 驗證字符
// （render 要成套瀏覽器 canvas／DOM 環境），但至少確保呢個資料夾本身存在
// 又唔係得個空殼——冇咗成個資料夾，或者複製漏咗底下嘅檔案，呢度就會爆。
test('vendor/pdfjs/cmaps 已就位且非空（缺咗會令中文縮圖靜靜雞變空白格）', () => {
  const dir = new URL('../vendor/pdfjs/cmaps/', import.meta.url);
  assert.ok(existsSync(dir), '缺 ../vendor/pdfjs/cmaps/');
  const files = readdirSync(dir);
  assert.ok(files.length > 0, 'vendor/pdfjs/cmaps/ 存在但係空資料夾');
});
