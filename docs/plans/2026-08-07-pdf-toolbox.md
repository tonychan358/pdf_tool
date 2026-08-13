# PDF 工具箱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 起一個純靜態、零後端的本地 PDF 工具箱，七個工具解決香港老師掃描功課／出卷／印筆記的日常痛點，檔案全程不離開瀏覽器。

**Architecture:** 多頁靜態網站 —— `index.html` 做 hub，每個工具一個獨立 HTML 頁。所有純計算邏輯（分頁分組、檔名、交錯順序、N-up 版面）抽成無依賴 ES module，用 `node:test` 做 TDD；瀏覽器層用共用 `toolpage.mjs` 統一處理拖放、進度、錯誤、輸出，令每個工具頁只需寫自己的選項面板同一個 `run()`。

**Tech Stack:** 原生 ES modules、`pdf-lib@1.17.1`（ESM build）、`pdfjs-dist@6.2.108`（`.mjs`，只有頁面編輯用）、`jszip@3.10.1`（**UMD only，必須用 `<script>` 載入讀 `window.JSZip`**）、`node:test`（單元測試）。無 framework、無 bundler、無 build step。

**Spec:** `100_Todo/pdf-toolbox/docs/specs/2026-08-07-pdf-toolbox-design.md`

---

## Global Constraints

以下每條適用於全部 task，唔會逐個 task 重複：

- **零對外請求**。程式碼內不得出現 `fetch()` / `XMLHttpRequest` 指向外部 host，唯一例外是 `i18n.mjs` 讀同源的 `assets/i18n/*.json`、以及 pdf.js 自行讀同源 `vendor/pdfjs/cmaps/`。不得引用任何 CDN。
- **零 build step**。不得引入 bundler、transpiler、CSS 前處理器。`package.json` 只用於 `devDependencies` 同 `npm test`，vendor 檔以實體檔案 commit 入 `vendor/`。
- **測試指令固定為 `node --test`（不帶參數）**。Node 24 之下 `node --test tests/` 會 `MODULE_NOT_FOUND`，測試一個都唔跑但 exit code 1，極易誤判（見 memory `pitfall_node_test_dir_arg`）。測試檔命名 `tests/*.test.mjs`。
- **純邏輯模組零依賴**。`paging.mjs`、`naming.mjs` 不得 import 任何嘢，不得掂 DOM、不得掂 pdf-lib。呢個係佢哋可以喺 Node 直接測嘅前提。
- **所有 .bat 必須 CRLF**，並由 `.gitattributes` 的 `*.bat text eol=crlf` 守住（見 memory `pitfall_bat_needs_crlf`）。LF 會令 cmd.exe 斬錯指令。
- **Port 8010**。8000 已被 `DSE-PP-Database` 佔用。
- **雙語**。任何顯示畀用戶睇嘅字串一律經 `data-i18n` 或 `t()`，禁止 hardcode 中文或英文喺 HTML／JS 內。每加一個 key 必須同時寫入 `zh.json` 同 `en.json`。
- **對外文案用書面語**（見 memory `feedback_deliverables_in_written_chinese`）。介面文字、README 用書面中文，唔用口語。
- **視覺依 `DESIGN.md`（edu-light）**。primary `#6366f1`、bg-base `#fafafa`、bg-surface `#ffffff`、success `#10b981`、warning `#f59e0b`、error `#ef4444`、text-primary `#111827`、text-secondary `#6b7280`、border-default `#e5e7eb`、字體 `Inter, system-ui, sans-serif`。未經 Lonely SIR 批准不得偏離。
- **檔名非法字元** 為 `\ / : * ? " < > |`，一律替換成 `_`。
- **PDF 座標系原點在左下角**，單位 pt。寫版面計算時記住 y 軸向上。
- **每個 task 結尾必須 commit**，用 scoped pathspec（只 add 該 task 的檔），commit 前跑 `git diff --cached --name-only` 確認範圍（見 memory `feedback_git_concurrent_commits`）。commit message 用繁中。

---

## File Structure

| 檔案 | 責任 | 由哪個 Task 建立 |
| :--- | :--- | :--- |
| `package.json` | 只放 `test` script 同 devDependency，非執行期依賴 | 1 |
| `.gitattributes` | 守 `*.bat` CRLF | 1 |
| `vendor/pdf-lib.esm.min.js` | pdf-lib ESM build | 1 |
| `vendor/jszip.min.js` | JSZip UMD build | 1 |
| `vendor/pdfjs/pdf.min.mjs` `pdf.worker.min.mjs` `cmaps/` | pdf.js（只有頁面編輯用） | 1 |
| `啟動PDF工具箱.bat` / `關閉PDF工具箱.bat` | 本機起／停 server（port 8010） | 1 |
| `assets/core/paging.mjs` | **純計算**：分組、範圍解析、交錯順序、N-up 版面、旋轉邊對應 | 2, 4, 5 |
| `assets/core/naming.mjs` | **純字串**：sanitize、名單解析、pattern 展開、名稱組裝去重 | 3 |
| `assets/core/i18n.mjs` | 掃 `data-i18n` 填字、切語言、存 localStorage | 6 |
| `assets/i18n/zh.json` `en.json` | 文案 | 6 起，每個 task 增補 |
| `assets/css/design.css` | edu-light tokens + 共用元件樣式 | 6 |
| `index.html` | hub 入口，七張工具卡 | 6 |
| `assets/core/pdf.mjs` | pdf-lib 封裝：載入、抽頁組檔、嵌頁、改尺寸 | 7 |
| `assets/core/zip.mjs` | `[{name,bytes}]` → 觸發下載（單檔直落、多檔打包） | 7 |
| `assets/core/dropzone.mjs` | 拖放收檔 + 可拖曳排序清單（零 pdf 依賴） | 7 |
| `assets/core/toolpage.mjs` | 工具頁共用外殼：拼裝 dropzone／進度／錯誤／輸出 | 7 |
| `tools/split.html` | 拆分（招牌功能，兩段式：預覽 → 下載） | 8 |
| `tools/merge.html` | 合併 | 9 |
| `tools/interleave.html` | 交錯合併（兩個 dropzone，唔用 toolpage 單檔外殼） | 10 |
| `tools/images-to-pdf.html` | 圖片轉 PDF | 11 |
| `assets/core/thumbs.mjs` + `tools/organize.html` | 頁面編輯（唯一載 pdf.js 者） | 12 |
| `tools/nup.html` | N-up 拼版 | 13 |
| `tools/margin.html` | 批改留白 | 14 |
| `README.md`、`docs/progress.md`、`test-fixtures/` | 文件與手動 smoke test | 15 |

---

## Task 1: 專案骨架、vendor、BAT、測試跑得起

**Files:**
- Create: `100_Todo/pdf-toolbox/package.json`
- Create: `100_Todo/pdf-toolbox/.gitattributes`
- Create: `100_Todo/pdf-toolbox/.gitignore`
- Create: `100_Todo/pdf-toolbox/DESIGN.md`（由 design-library 複製）
- Create: `100_Todo/pdf-toolbox/vendor/`（三個庫的 dist 檔）
- Create: `100_Todo/pdf-toolbox/啟動PDF工具箱.bat`、`關閉PDF工具箱.bat`
- Test: `100_Todo/pdf-toolbox/tests/smoke.test.mjs`

**Interfaces:**
- Consumes: 無（第一個 task）
- Produces: 可執行的 `npm test`（即 `node --test`）；`vendor/` 內固定路徑的三個庫供後續全部 task import

以下全部指令的工作目錄均為 `100_Todo/pdf-toolbox/`。

- [ ] **Step 1: 建目錄骨架**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
mkdir -p assets/core assets/css assets/i18n tools vendor/pdfjs tests test-fixtures docs/plans docs/specs
```

- [ ] **Step 2: 寫 `package.json`**

```json
{
  "name": "pdf-toolbox",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "本地 PDF 工具箱 — 純靜態、零後端、檔案不離開瀏覽器",
  "scripts": {
    "test": "node --test"
  }
}
```

注意 `"test": "node --test"` **不帶任何路徑參數**。Node 24 之下加 `tests/` 會爆 `MODULE_NOT_FOUND`。

- [ ] **Step 3: 寫 `.gitattributes` 同 `.gitignore`**

`.gitattributes`：
```
*.bat text eol=crlf
*.md  text eol=lf
*.mjs text eol=lf
*.js  text eol=lf
*.json text eol=lf
*.html text eol=lf
*.css text eol=lf
```

`.gitignore`：
```
node_modules/
.DS_Store
*.log
```

`vendor/` **不入 gitignore** —— 要 commit 實體檔，令 GitHub Pages 直接可用。

- [ ] **Step 4: 落 vendor 檔**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
npm i --no-save --no-audit --no-fund pdf-lib@1.17.1 jszip@3.10.1 pdfjs-dist@6.2.108
cp node_modules/pdf-lib/dist/pdf-lib.esm.min.js  vendor/pdf-lib.esm.min.js
cp node_modules/jszip/dist/jszip.min.js          vendor/jszip.min.js
cp node_modules/pdfjs-dist/build/pdf.min.mjs        vendor/pdfjs/pdf.min.mjs
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs vendor/pdfjs/pdf.worker.min.mjs
cp -r node_modules/pdfjs-dist/cmaps                 vendor/pdfjs/cmaps
rm -rf node_modules package-lock.json
```

`cmaps/`（約 1.5MB）必須帶埋，否則含中文字型的 PDF 喺頁面編輯的縮圖會缺字。`standard_fonts/` 唔需要，因為本專案從不嵌入新字型。

- [ ] **Step 5: 驗 vendor 檔齊全**

Run:
```bash
ls -l vendor/pdf-lib.esm.min.js vendor/jszip.min.js vendor/pdfjs/pdf.min.mjs vendor/pdfjs/pdf.worker.min.mjs && ls vendor/pdfjs/cmaps | wc -l
```
Expected: 四個檔都在（分別約 512K / 96K / 445K / 1.3M），cmaps 目錄有過百個檔。

- [ ] **Step 6: 複製 DESIGN.md**

```bash
cp /d/AI_AGENT/claude/100_Todo/design-library/themes/edu-light/DESIGN.md ./DESIGN.md
```

- [ ] **Step 7: 寫 smoke 測試（確認 `node --test` 真係搵到測試）**

`tests/smoke.test.mjs`：
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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
```

- [ ] **Step 8: 跑測試**

Run: `npm test`
Expected: PASS，2 個測試通過。若見 `MODULE_NOT_FOUND` 代表 test script 寫錯咗（帶咗路徑參數）。

- [ ] **Step 9: 寫兩個 BAT**

`啟動PDF工具箱.bat`：
```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在啟動 PDF 工具箱 (port 8010)...
start "" http://localhost:8010/
npx --yes http-server -p 8010 -c-1 .
```

`關閉PDF工具箱.bat`：
```bat
@echo off
chcp 65001 >nul
echo 正在關閉 port 8010 的服務...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8010 ^| findstr LISTENING') do (
    echo 終止 PID %%a
    taskkill /F /PID %%a
)
echo 完成。
pause
```

`-c-1` 關快取，避免改完 JS 要 hard refresh。

- [ ] **Step 10: 轉 BAT 做 CRLF 並驗證**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
for f in 啟動PDF工具箱.bat 關閉PDF工具箱.bat; do
  python -c "import sys;p=sys.argv[1];d=open(p,'rb').read().replace(b'\r\n',b'\n').replace(b'\n',b'\r\n');open(p,'wb').write(d)" "$f"
done
file 啟動PDF工具箱.bat 關閉PDF工具箱.bat
```
Expected: 兩個都顯示 `CRLF line terminators`。

- [ ] **Step 11: 建 docs junction**

```powershell
New-Item -ItemType Junction -Path "D:\AI_AGENT\claude\200_Obsidian\202_Project\pdf-toolbox" -Target "D:\AI_AGENT\claude\100_Todo\pdf-toolbox\docs"
```

- [ ] **Step 12: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/package.json 100_Todo/pdf-toolbox/.gitattributes 100_Todo/pdf-toolbox/.gitignore 100_Todo/pdf-toolbox/DESIGN.md 100_Todo/pdf-toolbox/vendor 100_Todo/pdf-toolbox/tests 100_Todo/pdf-toolbox/啟動PDF工具箱.bat 100_Todo/pdf-toolbox/關閉PDF工具箱.bat
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 專案骨架、vendor 三庫、啟動/關閉 BAT (port 8010)"
```

---

## Task 2: `paging.mjs` — 分組與範圍解析

**Files:**
- Create: `assets/core/paging.mjs`
- Test: `tests/paging-group.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces:
  - `groupByCount(totalPages: number, n: number) => Array<{start:number,end:number}>` — 1-indexed、頭尾包含
  - `parseRanges(spec: string, totalPages: number) => Array<{start:number,end:number}>`
  - `eachPage(totalPages: number) => Array<{start:number,end:number}>`
  - 三者回傳格式一致，皆為 `{start, end}` 1-indexed inclusive。Task 8（拆分）直接消費。

- [ ] **Step 1: 寫失敗測試**

`tests/paging-group.test.mjs`：
```js
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

test('parseRanges：基本', () => {
  assert.deepEqual(parseRanges('1-3,4-8', 10), [{ start: 1, end: 3 }, { start: 4, end: 8 }]);
});

test('parseRanges：單頁、空白、全形逗號都食', () => {
  assert.deepEqual(parseRanges(' 1 , 5-6 ，9 ', 10),
    [{ start: 1, end: 1 }, { start: 5, end: 6 }, { start: 9, end: 9 }]);
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

test('eachPage', () => {
  assert.deepEqual(eachPage(3), [{ start: 1, end: 1 }, { start: 2, end: 2 }, { start: 3, end: 3 }]);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `Cannot find module '../assets/core/paging.mjs'`

- [ ] **Step 3: 寫最小實作**

`assets/core/paging.mjs`：
```js
// 純計算模組：不得 import 任何嘢、不得掂 DOM 或 pdf-lib。
// 全部頁碼為 1-indexed，範圍頭尾包含。

export function groupByCount(totalPages, n) {
  if (!Number.isInteger(totalPages) || totalPages < 1) throw new Error('總頁數必須為正整數');
  if (!Number.isInteger(n) || n < 1) throw new Error('每份頁數必須為正整數');
  const out = [];
  for (let start = 1; start <= totalPages; start += n) {
    out.push({ start, end: Math.min(start + n - 1, totalPages) });
  }
  return out;
}

export function eachPage(totalPages) {
  return groupByCount(totalPages, 1);
}

export function parseRanges(spec, totalPages) {
  if (!Number.isInteger(totalPages) || totalPages < 1) throw new Error('總頁數必須為正整數');
  const parts = String(spec).replace(/，/g, ',').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('請輸入頁碼範圍，例如 1-3,4-8');
  return parts.map(part => {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) throw new Error(`無法辨識的範圍：${part}`);
    const start = Number(m[1]);
    const end = m[2] === undefined ? start : Number(m[2]);
    if (start < 1 || end > totalPages) throw new Error(`範圍 ${part} 超出文件頁數（共 ${totalPages} 頁）`);
    if (start > end) throw new Error(`範圍 ${part} 的起始頁大於結束頁`);
    return { start, end };
  });
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，全部 groupByCount / parseRanges / eachPage 測試綠。

- [ ] **Step 5: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/core/paging.mjs 100_Todo/pdf-toolbox/tests/paging-group.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): paging 分組與範圍解析 + 單元測試"
```

---

## Task 3: `naming.mjs` — 檔名、名單、pattern

**Files:**
- Create: `assets/core/naming.mjs`
- Test: `tests/naming.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces:
  - `sanitizeFileName(name: string) => string` — 剝走 `\ / : * ? " < > |` 換 `_`，trim，空字串回 `未命名`
  - `parseRoster(text: string) => string[]` — 逐行 trim、略過空行
  - `expandPattern(pattern: string, index: number, total: number) => string` — `index` 0-indexed；`{n}` 依 `total` 位數補零
  - `buildNames({count, roster, pattern}) => {items: Array<{name, source, warning}>, unusedRoster: string[]}`
    - `source` 為 `'roster'` 或 `'pattern'`
    - `warning` 為 `null` / `'roster-short'` / `'duplicate'`
    - `name` 已含 `.pdf` 副檔名
  - Task 8（拆分）直接消費 `buildNames`。

- [ ] **Step 1: 寫失敗測試**

`tests/naming.test.mjs`：
```js
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

test('buildNames：老師自己打咗 _2 嘅名，唔碰撞就原樣保留', () => {
  const r = buildNames({ count: 1, roster: ['王小明_2'], pattern: 'x_{n}' });
  assert.equal(r.items[0].name, '王小明_2.pdf');
  assert.equal(r.items[0].warning, null);
});

test('buildNames：預先分咗身嘅兩個同名學生唔應報 duplicate', () => {
  const r = buildNames({ count: 2, roster: ['王小明', '王小明_2'], pattern: 'x_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['王小明.pdf', '王小明_2.pdf']);
  assert.ok(r.items.every(i => i.warning === null));
});

test('buildNames：名單項撞正自動生成嘅後綴（曾經會靜默覆蓋）', () => {
  const r = buildNames({ count: 3, roster: ['甲', '甲', '甲_2'], pattern: 'x_{n}' });
  assert.deepEqual(r.items.map(i => i.name), ['甲.pdf', '甲_2.pdf', '甲_2_2.pdf']);
  assert.equal(r.items[1].warning, 'duplicate');
  assert.equal(r.items[2].warning, 'duplicate');
});

test('buildNames：不變式——任何情況下都唔可以有兩個同名輸出', () => {
  const r = buildNames({
    count: 5, roster: ['王小明', '王小明_2', '王小明', '甲', '甲_2'], pattern: 'x_{n}',
  });
  const names = r.items.map(i => i.name);
  assert.equal(new Set(names).size, names.length);
});

test('buildNames：名單含非法字元一併 sanitize', () => {
  const r = buildNames({ count: 1, roster: ['5A/01 陳大文'], pattern: 'x_{n}' });
  assert.equal(r.items[0].name, '5A_01 陳大文.pdf');
});

test('buildNames：count 非正整數拋錯', () => {
  assert.throws(() => buildNames({ count: 0, roster: [], pattern: 'x' }), /份數/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `Cannot find module '../assets/core/naming.mjs'`

- [ ] **Step 3: 寫最小實作**

`assets/core/naming.mjs`：
```js
// 純字串模組：不得 import 任何嘢、不得掂 DOM 或 pdf-lib。

const ILLEGAL = /[\\/:*?"<>|]/g;
const DEFAULT_PATTERN = '未命名_{n}';

export function sanitizeFileName(name) {
  let s = String(name ?? '').replace(ILLEGAL, '_').trim();
  s = s.replace(/\.+$/, '').trim();   // Windows 唔容許檔名以句點結尾
  return s === '' ? '未命名' : s;
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
  const emitted = new Set();   // 追蹤已發出嘅「最終」檔名
  const items = [];

  for (let i = 0; i < count; i++) {
    const fromRoster = i < roster.length;
    let candidate = sanitizeFileName(
      fromRoster ? roster[i] : expandPattern(effectivePattern, i, count)
    );
    let warning = fromRoster ? null : (roster.length > 0 ? 'roster-short' : null);

    // 只喺真碰撞時加尾碼。唔碰撞嘅名一律原樣輸出、warning 保持 null——
    // 後綴只加不減，絕不改動老師打咗嘅字。
    if (emitted.has(candidate)) {
      let n = 2;
      while (emitted.has(`${candidate}_${n}`)) n++;
      candidate = `${candidate}_${n}`;
      warning = 'duplicate';
    }

    emitted.add(candidate);
    items.push({ name: `${candidate}.pdf`, source: fromRoster ? 'roster' : 'pattern', warning });
  }

  return { items, unusedRoster: roster.slice(count) };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，naming 全部測試綠，Task 2 的測試依然綠。

- [ ] **Step 5: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/core/naming.mjs 100_Todo/pdf-toolbox/tests/naming.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 檔名 sanitize、名單解析、pattern 展開與去重"
```

---

## Task 4: `paging.mjs` — 交錯合併順序

**Files:**
- Modify: `assets/core/paging.mjs`（追加 export，勿改動 Task 2 已有函式）
- Test: `tests/paging-interleave.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces: `interleave(frontCount: number, backCount: number, reverseBack: boolean) => Array<{stack:'front'|'back', index:number}>`
  - `index` 為該疊之內的 **0-indexed** 頁序
  - Task 10（交錯合併）直接消費

**背景**：老師用單面掃描器掃雙面文件時，會先掃晒所有正面（得出 p.1,3,5…），再反轉成疊掃背面。因為成疊反轉，背面那份的順序通常係倒轉的（p.6,4,2）。呢個函式負責咬合返正確次序。

- [ ] **Step 1: 寫失敗測試**

`tests/paging-interleave.test.mjs`：
```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `interleave is not a function`

- [ ] **Step 3: 追加實作到 `paging.mjs` 尾部**

```js
export function interleave(frontCount, backCount, reverseBack) {
  for (const v of [frontCount, backCount]) {
    if (!Number.isInteger(v) || v < 0) throw new Error('頁數必須為非負整數');
  }
  const back = Array.from({ length: backCount }, (_, i) => (reverseBack ? backCount - 1 - i : i));
  const out = [];
  const max = Math.max(frontCount, backCount);
  for (let i = 0; i < max; i++) {
    if (i < frontCount) out.push({ stack: 'front', index: i });
    if (i < backCount) out.push({ stack: 'back', index: back[i] });
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，interleave 全綠，Task 2/3 測試依然綠。

- [ ] **Step 5: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/core/paging.mjs 100_Todo/pdf-toolbox/tests/paging-interleave.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 交錯合併頁序計算（支援背面倒序、兩疊不等長）"
```

---

## Task 5: `paging.mjs` — N-up 版面與旋轉邊對應

**Files:**
- Modify: `assets/core/paging.mjs`（追加 export）
- Test: `tests/paging-layout.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces:
  - `A4 = {W: 595.28, H: 841.89}`（常數，pt）
  - `nupLayout({pageW, pageH, per, gutter = 10}) => {sheetW, sheetH, cells: Array<{x, y, w, h, scale}>}`
    - `per` 只接受 2 或 4
    - `per=2` → A4 橫向（842×595），左右兩格
    - `per=4` → A4 直向（595×842），2×2
    - `cells` 次序為由左至右、由上至下
    - `x, y` 係該頁繪製時左下角座標（已置中），`w, h` 係縮放後尺寸
    - Task 13（N-up）直接消費
  - `marginEdge(visualEdge: 'right'|'bottom', rotationDeg: number) => 'right'|'left'|'top'|'bottom'`
    - 把「用戶睇到嗰邊」換算成「mediabox 要撐大嗰邊」，處理 `/Rotate` 90/180/270
    - Task 14（批改留白）直接消費

- [ ] **Step 1: 寫失敗測試**

`tests/paging-layout.test.mjs`：
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { A4, nupLayout, marginEdge } from '../assets/core/paging.mjs';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

test('A4 常數', () => {
  near(A4.W, 595.28);
  near(A4.H, 841.89);
});

test('nupLayout：2-up 用橫向 A4，兩格左右排', () => {
  const l = nupLayout({ pageW: A4.W, pageH: A4.H, per: 2, gutter: 0 });
  near(l.sheetW, A4.H);
  near(l.sheetH, A4.W);
  assert.equal(l.cells.length, 2);
  assert.ok(l.cells[0].x < l.cells[1].x, '第一格喺左');
});

test('nupLayout：4-up 用直向 A4，2x2 由左至右由上至下', () => {
  const l = nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 0 });
  near(l.sheetW, A4.W);
  near(l.sheetH, A4.H);
  assert.equal(l.cells.length, 4);
  assert.ok(l.cells[0].x < l.cells[1].x, 'cell0 喺 cell1 左邊');
  assert.ok(l.cells[0].y > l.cells[2].y, 'cell0 喺 cell2 上面（PDF y 軸向上）');
  near(l.cells[0].y, l.cells[1].y);
  near(l.cells[0].x, l.cells[2].x);
});

test('nupLayout：縮放為等比且不超出格', () => {
  const l = nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 10 });
  const c = l.cells[0];
  const cellW = (l.sheetW - 3 * 10) / 2;
  const cellH = (l.sheetH - 3 * 10) / 2;
  near(c.w, A4.W * c.scale);
  near(c.h, A4.H * c.scale);
  assert.ok(c.w <= cellW + 0.01 && c.h <= cellH + 0.01, '唔可以爆格');
  near(c.scale, Math.min(cellW / A4.W, cellH / A4.H));
});

test('nupLayout：內容喺格內置中', () => {
  const gutter = 10;
  const l = nupLayout({ pageW: 100, pageH: 100, per: 4, gutter });
  const cellW = (l.sheetW - 3 * gutter) / 2;
  const c = l.cells[0];
  near(c.x, gutter + (cellW - c.w) / 2);
});

test('nupLayout：橫向來源頁照計', () => {
  const l = nupLayout({ pageW: 842, pageH: 595, per: 2, gutter: 0 });
  assert.equal(l.cells.length, 2);
  assert.ok(l.cells[0].scale > 0);
});

test('nupLayout：per 只收 2 或 4', () => {
  assert.throws(() => nupLayout({ pageW: 100, pageH: 100, per: 3 }), /每版頁數/);
  assert.throws(() => nupLayout({ pageW: 100, pageH: 100, per: 1 }), /每版頁數/);
});

test('nupLayout：非法尺寸拋錯', () => {
  assert.throws(() => nupLayout({ pageW: 0, pageH: 100, per: 2 }), /頁面尺寸/);
});

test('marginEdge：無旋轉時原樣', () => {
  assert.equal(marginEdge('right', 0), 'right');
  assert.equal(marginEdge('bottom', 0), 'bottom');
});

// /Rotate 係「顯示時順時針轉嘅角度」。順時針轉 90°，mediabox 嘅頂邊會走去顯示嘅右邊
// （把相片順時針一扭，頂邊就盪到右手邊）。marginEdge 問嘅係相反方向嘅問題：
// 「用戶睇到嘅右邊，坐住嘅係 mediabox 邊一邊？」→ 90° 時答案係 top。
test('marginEdge：90 度順時針旋轉', () => {
  assert.equal(marginEdge('right', 90), 'top');
  assert.equal(marginEdge('bottom', 90), 'right');
});

test('marginEdge：180 度', () => {
  assert.equal(marginEdge('right', 180), 'left');
  assert.equal(marginEdge('bottom', 180), 'top');
});

test('marginEdge：270 度', () => {
  assert.equal(marginEdge('right', 270), 'bottom');
  assert.equal(marginEdge('bottom', 270), 'left');
});

// 0° 同 180° 之下，正確映射同佢嘅反向映射結果一模一樣，所以人手寫嘅對照表
// 錯咗都可以全綠。呢條不變式測試先真正釘死方向：把 marginEdge 傳回嘅 mediabox 邊
// 順向轉返該角度，必須落返原本嗰個視覺邊。
test('marginEdge：round-trip 不變式（釘死映射方向）', () => {
  const EDGE_ORDER = ['top', 'right', 'bottom', 'left'];
  const forward = (edge, deg) =>
    EDGE_ORDER[(EDGE_ORDER.indexOf(edge) + (((deg / 90) % 4) + 4) % 4) % 4];

  for (const deg of [0, 90, 180, 270]) {
    for (const visual of EDGE_ORDER) {
      assert.equal(forward(marginEdge(visual, deg), deg), visual,
        `${visual} @ ${deg}° 唔 round-trip`);
    }
  }
});

test('marginEdge：角度正規化（-90、450 等同 270、90）', () => {
  assert.equal(marginEdge('right', -90), marginEdge('right', 270));
  assert.equal(marginEdge('right', 450), marginEdge('right', 90));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `A4 is not defined` / `nupLayout is not a function`

- [ ] **Step 3: 追加實作到 `paging.mjs` 尾部**

```js
export const A4 = { W: 595.28, H: 841.89 };

export function nupLayout({ pageW, pageH, per, gutter = 10 }) {
  if (per !== 2 && per !== 4) throw new Error('每版頁數只支援 2 或 4');
  if (!(pageW > 0) || !(pageH > 0)) throw new Error('頁面尺寸必須為正數');

  const cols = 2;
  const rows = per === 2 ? 1 : 2;
  const sheetW = per === 2 ? A4.H : A4.W;
  const sheetH = per === 2 ? A4.W : A4.H;

  const cellW = (sheetW - gutter * (cols + 1)) / cols;
  const cellH = (sheetH - gutter * (rows + 1)) / rows;
  const scale = Math.min(cellW / pageW, cellH / pageH);
  const w = pageW * scale;
  const h = pageH * scale;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = gutter + c * (cellW + gutter);
      // PDF y 軸向上：第 0 行喺最頂，所以由 sheetH 減落嚟
      const cellTop = sheetH - gutter - r * (cellH + gutter);
      const cellY = cellTop - cellH;
      cells.push({
        x: cellX + (cellW - w) / 2,
        y: cellY + (cellH - h) / 2,
        w, h, scale,
      });
    }
  }
  return { sheetW, sheetH, cells };
}

// 顯示時的視覺邊 → mediabox 上要撐大的邊。
// /Rotate 定義為「顯示時順時針旋轉的角度」，即 displayed = mediabox 順時針轉 steps，
// 亦即 index(displayed) = index(mediabox) + steps。marginEdge 要的是反方向，
// 故 index(mediabox) = index(visual) − steps。**切勿寫成 (i + steps)**：
// 0° 與 180° 之下兩者結果相同，寫錯了整套對照表仍會全綠。
const EDGE_ORDER = ['top', 'right', 'bottom', 'left'];

export function marginEdge(visualEdge, rotationDeg) {
  const i = EDGE_ORDER.indexOf(visualEdge);
  if (i === -1) throw new Error(`未知的邊：${visualEdge}`);
  const steps = ((Math.round(rotationDeg / 90) % 4) + 4) % 4;
  return EDGE_ORDER[(i - steps + 4) % 4];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，全部 paging / naming 測試綠。

- [ ] **Step 5: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/core/paging.mjs 100_Todo/pdf-toolbox/tests/paging-layout.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): N-up 版面計算與旋轉頁的留白邊對應"
```

---

## Task 6: 視覺基礎、i18n、hub 入口頁

**Files:**
- Create: `assets/css/design.css`
- Create: `assets/core/i18n.mjs`
- Create: `assets/i18n/zh.json`、`assets/i18n/en.json`
- Create: `index.html`
- Test: `tests/i18n.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces:
  - `initI18n() => Promise<void>` — 讀 localStorage 語言（預設 `zh`）、fetch 對應 json、掃全頁 `data-i18n` / `data-i18n-placeholder` 填字、綁右上角切換掣
  - `t(key: string, vars?: object) => string` — 取字串，`{name}` 形式的變數會替換
  - 後續每個工具頁都 `import { initI18n, t }` 並喺 `DOMContentLoaded` 呼叫 `initI18n()`

- [ ] **Step 1: 寫 i18n 一致性測試（先寫，因為佢會守住之後每個 task）**

`tests/i18n.test.mjs`：
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = n => JSON.parse(readFileSync(new URL(`../assets/i18n/${n}.json`, import.meta.url), 'utf8'));

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

test('zh 同 en 的 key 完全一致', () => {
  const zh = flatten(load('zh')).sort();
  const en = flatten(load('en')).sort();
  const missingEn = zh.filter(k => !en.includes(k));
  const missingZh = en.filter(k => !zh.includes(k));
  assert.deepEqual(missingEn, [], `en.json 缺少：${missingEn.join(', ')}`);
  assert.deepEqual(missingZh, [], `zh.json 缺少：${missingZh.join(', ')}`);
});

test('冇空字串值', () => {
  for (const lang of ['zh', 'en']) {
    const walk = (o, p = '') => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'object' && v !== null) walk(v, `${p}${k}.`);
        else assert.notEqual(String(v).trim(), '', `${lang}.json 的 ${p}${k} 係空值`);
      }
    };
    walk(load(lang));
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `ENOENT` 搵唔到 `assets/i18n/zh.json`

- [ ] **Step 3: 寫兩份 i18n json**

`assets/i18n/zh.json`：
```json
{
  "app": {
    "title": "PDF 工具箱",
    "tagline": "本地 PDF 處理工具，專為教師而設",
    "privacy": "所有處理在你電腦的瀏覽器內完成，檔案不會上傳到任何伺服器。",
    "backToHub": "← 返回工具箱",
    "langToggle": "English"
  },
  "common": {
    "dropPdf": "把 PDF 拖到這裡，或按此選擇檔案",
    "dropImages": "把圖片拖到這裡，或按此選擇檔案（JPG／PNG）",
    "run": "開始處理",
    "processing": "處理中 {done} / {total}",
    "done": "完成，已下載。",
    "pages": "共 {n} 頁",
    "remove": "移除",
    "dragToReorder": "可拖曳調整次序"
  },
  "error": {
    "encrypted": "此 PDF 有密碼保護，請先解鎖後再上傳。",
    "notPdf": "請拖入 PDF 檔。",
    "notImage": "請拖入 JPG 或 PNG 圖片。",
    "corrupt": "無法讀取此檔案，可能已損壞。",
    "oom": "檔案太大，瀏覽器記憶體不足。請試較小的檔案。",
    "noFile": "請先選擇檔案。",
    "generic": "處理時發生問題：{message}"
  },
  "hub": {
    "split": "拆分",
    "splitDesc": "一疊掃描功課，每 4 頁自動拆成一份，並依班別名單命名。",
    "merge": "合併",
    "mergeDesc": "把多份 PDF 依你排定的次序併成一份。",
    "interleave": "交錯合併",
    "interleaveDesc": "單面掃描器分開掃正反面後，咬合成正確頁序。",
    "images": "圖片轉 PDF",
    "imagesDesc": "把多張相片或截圖合成一份 A4 PDF。",
    "organize": "頁面編輯",
    "organizeDesc": "以縮圖檢視全部頁面，旋轉、刪除、重新排序。",
    "nup": "N-up 拼版",
    "nupDesc": "把 2 或 4 頁併成一版 A4，列印時節省紙張。",
    "margin": "批改留白",
    "marginDesc": "每頁加上空白邊，方便手寫評語。"
  }
}
```

`assets/i18n/en.json`：
```json
{
  "app": {
    "title": "PDF Toolbox",
    "tagline": "Local PDF tools built for teachers",
    "privacy": "Everything runs in your browser. Your files are never uploaded to any server.",
    "backToHub": "← Back to toolbox",
    "langToggle": "繁體中文"
  },
  "common": {
    "dropPdf": "Drop a PDF here, or click to choose a file",
    "dropImages": "Drop images here, or click to choose files (JPG / PNG)",
    "run": "Start",
    "processing": "Processing {done} / {total}",
    "done": "Done — your file has been downloaded.",
    "pages": "{n} pages",
    "remove": "Remove",
    "dragToReorder": "Drag to reorder"
  },
  "error": {
    "encrypted": "This PDF is password-protected. Please unlock it first.",
    "notPdf": "Please drop a PDF file.",
    "notImage": "Please drop a JPG or PNG image.",
    "corrupt": "Could not read this file — it may be damaged.",
    "oom": "The file is too large for your browser's memory. Try a smaller file.",
    "noFile": "Please choose a file first.",
    "generic": "Something went wrong: {message}"
  },
  "hub": {
    "split": "Split",
    "splitDesc": "Cut a stack of scanned homework into one file every N pages, named from your class list.",
    "merge": "Merge",
    "mergeDesc": "Combine several PDFs into one, in the order you set.",
    "interleave": "Interleave",
    "interleaveDesc": "Scanned fronts and backs separately? Weave them back into the right page order.",
    "images": "Images to PDF",
    "imagesDesc": "Turn photos or screenshots into a single A4 PDF.",
    "organize": "Organize pages",
    "organizeDesc": "See every page as a thumbnail — rotate, delete, reorder.",
    "nup": "N-up",
    "nupDesc": "Fit 2 or 4 pages onto one A4 sheet to save paper.",
    "margin": "Marking margin",
    "marginDesc": "Add blank space to every page for handwritten comments."
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，i18n 兩個測試綠。

- [ ] **Step 5: 寫 `assets/core/i18n.mjs`**

> **2026-08-12 更新（Task 15 自我審查）**：以下係實際落地嘅版本，比下筆計畫嗰刻多咗
> fetch 失敗處理——原本嘅版本 `fetch` 或 `res.json()` 一旦失敗會拋出未捕獲嘅
> rejection，令 `initI18n()` 個 `await` 卡死，成頁淨低一句撳咗都冇反應嘅
> 「载入中」空白。見本檔最尾 Self-Review 記錄第 5 點。

```js
const STORAGE_KEY = 'pdf-toolbox-lang';
const LOAD_ERROR_ID = 'i18n-load-error';
// 字典本身載入失敗，冇辦法用 t() 揾字（雞先定蛋先問題），呢句必須寫死雙語。
const LOAD_ERROR_TEXT = '無法載入介面文字，請重新整理頁面。 / Could not load interface text. Please reload the page.';
let dict = {};
let lang = 'zh';

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function t(key, vars = {}) {
  const raw = get(dict, key);
  if (raw === undefined) return key;
  return String(raw).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function currentLang() {
  return lang;
}

function apply(root = document) {
  document.getElementById(LOAD_ERROR_ID)?.remove(); // 呢次 load 成功，之前殘留嘅失敗橫幅要撤走
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  const titleKey = document.body.dataset.titleKey;
  document.title = titleKey ? `${t(titleKey)} — ${t('app.title')}` : t('app.title');
}

function showLoadError() {
  if (document.getElementById(LOAD_ERROR_ID)) return; // 唔好疊加多過一條banner
  const el = document.createElement('div');
  el.id = LOAD_ERROR_ID;
  el.className = 'msg error';
  el.textContent = LOAD_ERROR_TEXT;
  document.body.prepend(el);
}

async function load(next) {
  const base = new URL('../i18n/', import.meta.url);
  try {
    const res = await fetch(new URL(`${next}.json`, base));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    dict = await res.json();
    lang = next;
    localStorage.setItem(STORAGE_KEY, next);
    apply();
  } catch (err) {
    showLoadError();
  }
}

export async function initI18n() {
  await load(localStorage.getItem(STORAGE_KEY) || 'zh');
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.addEventListener('click', () => load(lang === 'zh' ? 'en' : 'zh'));
  }
}

// 動態插入的元素填字後呼叫
export { apply as applyI18n };
```

- [ ] **Step 6: 寫 `assets/css/design.css`**

> **2026-08-12 更新（Task 15 自我審查）**：以下係實際落地嘅版本，同下筆計畫嗰刻有兩處
> 分別：(1) 補咗 `--success-800` / `--warning-800` / `--error-800` 三個較深色調
> token，畀 `.privacy`／`.msg.*` 嘅文字色用，達到 WCAG AA 4.5:1 對比（下筆計畫版本
> 直接用返 `-50`／`-600` 呢兩級，冇專門計過文字對淺色底嘅對比）；(2) `body` 嘅
> `font-family` 拎走咗 `"Noto Sans TC"`——vendor 目錄冇帶呢隻字型嘅檔案，寫死喺
> font stack 會喺冇裝呢隻字嘅裝置上靜靜雞跌落 fallback，且同「零外部資源」嘅
> 定位有少少混淆（會令人以為呢個 project 要求／假設某隻特定字型存在）。見本檔
> 最尾 Self-Review 記錄第 5 點。

```css
/* edu-light tokens — 見 DESIGN.md，未經批准不得偏離 */
:root {
  --bg-base: #fafafa;
  --bg-surface: #ffffff;
  --bg-elevated: #f4f4f8;
  --primary-50: #eef2ff;
  --primary-500: #6366f1;
  --primary-600: #4f46e5;
  --primary-700: #4338ca;
  --success-50: #d1fae5;
  --success-500: #10b981;
  --success-600: #059669;
  --success-800: #065f46; /* 6.78:1 contrast on --success-50 for text; meets WCAG AA 4.5:1 */
  --warning-50: #fef3c7;
  --warning-500: #f59e0b;
  --warning-600: #d97706;
  --warning-800: #92400e; /* 6.37:1 contrast on --warning-50 for text; meets WCAG AA 4.5:1 */
  --error-50: #fee2e2;
  --error-500: #ef4444;
  --error-600: #dc2626;
  --error-800: #991b1b; /* 6.80:1 contrast on --error-50 for text; meets WCAG AA 4.5:1 */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border-default: #e5e7eb;
  --border-strong: #d1d5db;
  --radius: 12px;
  --shadow: 0 1px 3px rgb(17 24 39 / 8%), 0 4px 12px rgb(17 24 39 / 5%);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0 1rem 4rem;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: Inter, system-ui, sans-serif;
  line-height: 1.6;
}

.wrap { max-width: 880px; margin: 0 auto; }

header.site {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 0 1rem;
}
header.site h1 { font-size: 1.75rem; font-weight: 700; margin: 0; }
header.site a { color: var(--text-secondary); text-decoration: none; font-size: .95rem; }
header.site a:hover { color: var(--primary-600); }

.privacy {
  background: var(--success-50);
  color: var(--success-800);
  border-radius: var(--radius);
  padding: .75rem 1rem;
  font-size: .9rem;
  margin-bottom: 1.5rem;
}

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}
.tool-card {
  display: block;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: border-color .15s, transform .15s, box-shadow .15s;
}
.tool-card:hover {
  border-color: var(--primary-500);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}
.tool-card h2 { margin: 0 0 .4rem; font-size: 1.15rem; font-weight: 700; color: var(--primary-600); }
.tool-card p  { margin: 0; font-size: .92rem; color: var(--text-secondary); }

.dropzone {
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.dropzone:hover, .dropzone.over {
  border-color: var(--primary-500);
  background: var(--primary-50);
  color: var(--primary-700);
}

.filelist { list-style: none; margin: 1rem 0 0; padding: 0; }
.filelist li {
  display: flex; align-items: center; gap: .75rem;
  background: var(--bg-elevated);
  border-radius: 8px; padding: .6rem .85rem; margin-bottom: .4rem;
  cursor: grab; font-size: .92rem;
}
.filelist li.dragging { opacity: .4; }
.filelist .grip { color: var(--text-muted); }
.filelist .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.filelist button {
  border: none; background: none; color: var(--error-600);
  cursor: pointer; font-size: .85rem;
}

label { display: block; font-weight: 600; font-size: .92rem; margin: 1rem 0 .35rem; }
input[type="text"], input[type="number"], textarea, select {
  width: 100%; padding: .55rem .7rem;
  border: 1px solid var(--border-default); border-radius: 8px;
  background: var(--bg-elevated); color: var(--text-primary);
  font: inherit; font-size: .95rem;
}
input:focus, textarea:focus, select:focus { outline: 2px solid var(--primary-500); outline-offset: 1px; }
textarea { min-height: 9rem; resize: vertical; font-family: ui-monospace, monospace; }
.radio-row { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: .5rem 0; }
.radio-row label { display: flex; align-items: center; gap: .4rem; margin: 0; font-weight: 400; }
.hint { font-size: .85rem; color: var(--text-muted); margin-top: .3rem; }

button.primary {
  background: var(--primary-500); color: #fff;
  border: none; border-radius: 8px;
  padding: .7rem 1.4rem; font: inherit; font-weight: 600;
  cursor: pointer; margin-top: 1.25rem;
}
button.primary:hover:not(:disabled) { background: var(--primary-600); }
button.primary:disabled { background: var(--border-strong); cursor: not-allowed; }
button.secondary {
  background: var(--bg-surface); color: var(--primary-600);
  border: 1px solid var(--primary-500); border-radius: 8px;
  padding: .7rem 1.4rem; font: inherit; font-weight: 600;
  cursor: pointer; margin-top: 1.25rem;
}

.msg { border-radius: 8px; padding: .7rem 1rem; margin-top: 1rem; font-size: .92rem; }
.msg.error   { background: var(--error-50);   color: var(--error-800); }
.msg.ok      { background: var(--success-50); color: var(--success-800); }
.msg.warn    { background: var(--warning-50); color: var(--warning-800); }
.msg[hidden] { display: none; }

table.preview { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: .9rem; }
table.preview th, table.preview td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid var(--border-default); }
table.preview th { color: var(--text-secondary); font-weight: 600; }
table.preview tr.warn { background: var(--warning-50); }
table.preview tr.dup  { background: var(--error-50); }

.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: .8rem; margin-top: 1rem; }
.thumb { position: relative; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px; padding: .4rem; cursor: grab; }
.thumb.dragging { opacity: .4; }
.thumb canvas { width: 100%; height: auto; display: block; }
.thumb .no { position: absolute; top: .3rem; left: .3rem; background: rgb(17 24 39 / 70%); color: #fff; font-size: .7rem; padding: .05rem .35rem; border-radius: 4px; }
.thumb .acts { display: flex; justify-content: center; gap: .5rem; margin-top: .3rem; }
.thumb .acts button { border: none; background: none; cursor: pointer; font-size: .95rem; color: var(--text-secondary); }
.thumb.removed { opacity: .3; }
```

- [ ] **Step 7: 寫 `index.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PDF 工具箱</title>
<link rel="stylesheet" href="assets/css/design.css">
</head>
<body>
<div class="wrap">
  <header class="site">
    <h1 data-i18n="app.title">PDF 工具箱</h1>
    <button id="lang-toggle" class="secondary" style="margin:0;padding:.4rem .8rem" data-i18n="app.langToggle">English</button>
  </header>
  <p style="color:var(--text-secondary);margin-top:-.5rem" data-i18n="app.tagline"></p>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="tool-grid">
    <a class="tool-card" href="tools/split.html">
      <h2 data-i18n="hub.split"></h2><p data-i18n="hub.splitDesc"></p>
    </a>
    <a class="tool-card" href="tools/merge.html">
      <h2 data-i18n="hub.merge"></h2><p data-i18n="hub.mergeDesc"></p>
    </a>
    <a class="tool-card" href="tools/interleave.html">
      <h2 data-i18n="hub.interleave"></h2><p data-i18n="hub.interleaveDesc"></p>
    </a>
    <a class="tool-card" href="tools/images-to-pdf.html">
      <h2 data-i18n="hub.images"></h2><p data-i18n="hub.imagesDesc"></p>
    </a>
    <a class="tool-card" href="tools/organize.html">
      <h2 data-i18n="hub.organize"></h2><p data-i18n="hub.organizeDesc"></p>
    </a>
    <a class="tool-card" href="tools/nup.html">
      <h2 data-i18n="hub.nup"></h2><p data-i18n="hub.nupDesc"></p>
    </a>
    <a class="tool-card" href="tools/margin.html">
      <h2 data-i18n="hub.margin"></h2><p data-i18n="hub.marginDesc"></p>
    </a>
  </div>
</div>
<script type="module">
  import { initI18n } from './assets/core/i18n.mjs';
  initI18n();
</script>
</body>
</html>
```

- [ ] **Step 8: 手動驗證 hub**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox && npx --yes http-server -p 8010 -c-1 . &
```
開 `http://localhost:8010/`，確認：七張卡顯示中文、按右上角切到英文後全頁變英文、重新整理後保持英文、七條連結指向 `tools/*.html`（此時仍為 404，正常）。驗完 `關閉PDF工具箱.bat`。

- [ ] **Step 9: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/css 100_Todo/pdf-toolbox/assets/core/i18n.mjs 100_Todo/pdf-toolbox/assets/i18n 100_Todo/pdf-toolbox/index.html 100_Todo/pdf-toolbox/tests/i18n.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): edu-light 樣式、中英 i18n、hub 入口頁"
```

---

## Task 7: 瀏覽器層共用模組（pdf / zip / dropzone / toolpage）

**Files:**
- Create: `assets/core/pdf.mjs`
- Create: `assets/core/zip.mjs`
- Create: `assets/core/dropzone.mjs`
- Create: `assets/core/toolpage.mjs`

**Interfaces:**
- Consumes: `vendor/pdf-lib.esm.min.js`、`vendor/jszip.min.js`（UMD，經 `<script>` 提供 `window.JSZip`）、`i18n.mjs` 的 `t()`
- Produces:
  - `pdf.mjs`
    - `loadPdf(file: File) => Promise<PDFDocument>` — 已包好加密／損壞的錯誤轉換
    - `newPdf() => Promise<PDFDocument>`
    - `copyRange(src, dest, start, end) => Promise<void>` — 1-indexed inclusive
    - `save(doc) => Promise<Uint8Array>`
    - `PDFLib` — 直接 re-export，供需要低階 API 的工具用
    - `AppError` — 帶 `i18nKey` 的錯誤類別
  - `zip.mjs`：`deliver(outputs: Array<{name, bytes}>, zipName: string) => Promise<void>`
    - 一個輸出 → 直接下載該 PDF；多個 → 打包 ZIP 下載
  - `dropzone.mjs`
    - `createDropzone(el, {accept, multiple, onChange}) => {files, clear}`
    - `renderFileList(ulEl, files, {sortable, onChange})`
  - `toolpage.mjs`：`mountTool({dropEl, listEl, runBtn, msgEl, accept, multiple, sortable, run}) => controller`
    - `controller.files` — 目前檔案陣列
    - `controller.showError(i18nKey, vars)` / `showOk(key, vars)` / `showWarn(key, vars)`
    - `controller.setProgress(done, total)`
    - `run` 回呼簽名：`async (files, ctx) => Array<{name, bytes}>`，`ctx.progress(done, total)`

- [ ] **Step 1: 寫 `assets/core/pdf.mjs`**

```js
import * as PDFLibNS from '../../vendor/pdf-lib.esm.min.js';
export const PDFLib = PDFLibNS;

export class AppError extends Error {
  constructor(i18nKey, vars = {}) {
    super(i18nKey);
    this.i18nKey = i18nKey;
    this.vars = vars;
  }
}

export async function loadPdf(file) {
  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new AppError('error.notPdf');
  }
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new AppError('error.corrupt');
  }
  try {
    return await PDFLibNS.PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (e) {
    const m = String(e && e.message);
    if (/encrypt/i.test(m)) throw new AppError('error.encrypted');
    if (/RangeError|out of memory|Array buffer allocation/i.test(m)) throw new AppError('error.oom');
    throw new AppError('error.corrupt');
  }
}

export async function newPdf() {
  return PDFLibNS.PDFDocument.create();
}

// start / end 為 1-indexed、頭尾包含
export async function copyRange(src, dest, start, end) {
  const indices = [];
  for (let p = start; p <= end; p++) indices.push(p - 1);
  const pages = await dest.copyPages(src, indices);
  pages.forEach(pg => dest.addPage(pg));
}

export async function save(doc) {
  return doc.save({ useObjectStreams: true });
}
```

- [ ] **Step 2: 寫 `assets/core/zip.mjs`**

```js
// JSZip 只有 UMD build，冇 ESM。載入頁面必須有：
//   <script src="../vendor/jszip.min.js"></script>
// 本模組讀 window.JSZip。

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deliver(outputs, zipName) {
  if (outputs.length === 0) return;
  if (outputs.length === 1) {
    download(new Blob([outputs[0].bytes], { type: 'application/pdf' }), outputs[0].name);
    return;
  }
  if (!window.JSZip) throw new Error('缺少 JSZip：頁面未載入 vendor/jszip.min.js');
  const zip = new window.JSZip();
  for (const o of outputs) zip.file(o.name, o.bytes);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  download(blob, zipName);
}
```

`compression: 'STORE'` 唔壓縮 —— PDF 本身已壓縮，再壓幾乎冇得益但慢好多。

- [ ] **Step 3: 寫 `assets/core/dropzone.mjs`**

```js
import { t } from './i18n.mjs';

function matches(file, accept) {
  if (accept === 'pdf') return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (accept === 'image') return /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
  return true;
}

export function createDropzone(el, { accept = 'pdf', multiple = false, onChange = () => {} }) {
  const state = { files: [] };
  const input = document.createElement('input');
  input.type = 'file';
  input.hidden = true;
  input.multiple = multiple;
  input.accept = accept === 'image' ? 'image/jpeg,image/png' : 'application/pdf';
  el.after(input);

  const take = list => {
    const incoming = Array.from(list).filter(f => matches(f, accept));
    if (incoming.length === 0) {
      onChange(state.files, accept === 'image' ? 'error.notImage' : 'error.notPdf');
      return;
    }
    state.files = multiple ? state.files.concat(incoming) : [incoming[0]];
    onChange(state.files, null);
  };

  el.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { take(input.files); input.value = ''; });
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('over');
    take(e.dataTransfer.files);
  });

  return {
    get files() { return state.files; },
    set files(v) { state.files = v; onChange(state.files, null); },
    clear() { state.files = []; onChange(state.files, null); },
  };
}

export function renderFileList(ul, files, { sortable = false, onChange = () => {} } = {}) {
  ul.innerHTML = '';
  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.draggable = sortable;
    li.dataset.index = String(i);
    li.innerHTML =
      `${sortable ? '<span class="grip">⠿</span>' : ''}` +
      `<span class="name"></span><button type="button"></button>`;
    li.querySelector('.name').textContent = f.name;
    const btn = li.querySelector('button');
    btn.textContent = t('common.remove');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onChange(files.filter((_, j) => j !== i));
    });
    ul.appendChild(li);
  });

  if (!sortable) return;
  let from = null;
  ul.addEventListener('dragstart', e => {
    from = Number(e.target.dataset.index);
    e.target.classList.add('dragging');
  });
  ul.addEventListener('dragend', e => e.target.classList.remove('dragging'));
  ul.addEventListener('dragover', e => e.preventDefault());
  ul.addEventListener('drop', e => {
    e.preventDefault();
    const li = e.target.closest('li');
    if (!li || from === null) return;
    const to = Number(li.dataset.index);
    const next = files.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    from = null;
    onChange(next);
  });
}
```

- [ ] **Step 4: 寫 `assets/core/toolpage.mjs`**

```js
import { initI18n, t } from './i18n.mjs';
import { createDropzone, renderFileList } from './dropzone.mjs';
import { deliver } from './zip.mjs';
import { AppError } from './pdf.mjs';

export async function mountTool({
  dropEl, listEl, runBtn, msgEl,
  accept = 'pdf', multiple = false, sortable = false,
  zipName = 'pdf-toolbox.zip',
  run,
}) {
  await initI18n();

  const msg = (cls, key, vars) => {
    msgEl.className = `msg ${cls}`;
    msgEl.textContent = t(key, vars);
    msgEl.hidden = false;
  };
  const clearMsg = () => { msgEl.hidden = true; };

  const ctrl = {
    files: [],
    showError: (key, vars) => msg('error', key, vars),
    showOk: (key, vars) => msg('ok', key, vars),
    showWarn: (key, vars) => msg('warn', key, vars),
    clearMsg,
    setProgress: (done, total) => msg('ok', 'common.processing', { done, total }),
  };

  const sync = files => {
    ctrl.files = files;
    if (listEl) renderFileList(listEl, files, { sortable, onChange: sync });
    if (runBtn) runBtn.disabled = files.length === 0;
  };

  const dz = createDropzone(dropEl, {
    accept, multiple,
    onChange: (files, errKey) => {
      if (errKey) { ctrl.showError(errKey); return; }
      clearMsg();
      sync(files);
    },
  });
  ctrl.clearFiles = () => dz.clear();
  sync([]);

  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      if (ctrl.files.length === 0) { ctrl.showError('error.noFile'); return; }
      runBtn.disabled = true;
      try {
        const outputs = await run(ctrl.files, {
          progress: (d, n) => ctrl.setProgress(d, n),
        });
        await deliver(outputs, zipName);
        ctrl.showOk('common.done');
      } catch (e) {
        if (e instanceof AppError) ctrl.showError(e.i18nKey, e.vars);
        else ctrl.showError('error.generic', { message: String(e && e.message || e) });
      } finally {
        runBtn.disabled = false;
      }
    });
  }

  return ctrl;
}

// 每處理完一件就讓出主執行緒，令進度條真係畫得出
export const yieldToUI = () => new Promise(r => setTimeout(r, 0));
```

- [ ] **Step 5: 靜態語法檢查**

因為呢批模組 import 咗瀏覽器專用嘅 vendor 檔（`pdf-lib.esm.min.js`、`pdf.min.mjs`），喺 Node 直接 `import` 會行到瀏覽器 API 而爆。改用 `node --check` 做語法驗證 —— 佢只 parse 唔執行、亦唔會解析 import 路徑，正好合用，而且唔需要任何 experimental flag。

`tests/syntax.test.mjs`：
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../assets/core/', import.meta.url));

test('assets/core 內全部 .mjs 語法正確', () => {
  const files = readdirSync(dir).filter(n => n.endsWith('.mjs'));
  assert.ok(files.length > 0, 'assets/core 內搵唔到任何 .mjs');
  for (const f of files) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--check', dir + f], { stdio: 'pipe' }),
      `${f} 語法錯誤`
    );
  }
});
```

Run: `npm test`
Expected: PASS。`package.json` 的 test script 維持 `node --test`，不得改動。

- [ ] **Step 6: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/core/pdf.mjs 100_Todo/pdf-toolbox/assets/core/zip.mjs 100_Todo/pdf-toolbox/assets/core/dropzone.mjs 100_Todo/pdf-toolbox/assets/core/toolpage.mjs 100_Todo/pdf-toolbox/tests/syntax.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 瀏覽器共用層（pdf-lib 封裝、ZIP 輸出、拖放、工具頁外殼）"
```

---

## Task 8: 拆分工具（招牌功能）

**Files:**
- Create: `tools/split.html`
- Modify: `assets/i18n/zh.json`、`assets/i18n/en.json`（加 `split.*`）
- Test: 手動（見 Step 5）

**Interfaces:**
- Consumes: `groupByCount` / `parseRanges` / `eachPage`（Task 2）、`buildNames` / `parseRoster`（Task 3）、`loadPdf` / `newPdf` / `copyRange` / `save`（Task 7）、`mountTool` / `yieldToUI`（Task 7）
- Produces: 無下游依賴

兩段式流程：先「產生預覽」出對照表，確認後才「下載 ZIP」。

- [ ] **Step 1: 加 i18n keys**

`zh.json` 加頂層 `"split"`：
```json
  "split": {
    "title": "拆分",
    "modeCount": "每 N 頁一份",
    "modeRanges": "自訂頁碼範圍",
    "modeEach": "逐頁拆成單張",
    "everyN": "每份頁數",
    "ranges": "頁碼範圍",
    "rangesHint": "以逗號分隔，例如 1-3,4-8,9-12",
    "roster": "班別名單（選填，每行一個）",
    "rosterHint": "從 Excel 選一欄複製，直接貼上即可。留空則使用下方命名模式。",
    "pattern": "命名模式",
    "patternHint": "{n} 會自動換成序號並補零。",
    "preview": "產生預覽",
    "download": "下載 ZIP",
    "colRange": "頁碼",
    "colName": "輸出檔名",
    "willSplit": "將拆成 {n} 份",
    "rosterShort": "名單只有 {roster} 個，但會拆出 {count} 份，餘下的以命名模式補上。",
    "rosterLong": "名單有 {roster} 個，多過拆出的 {count} 份，多餘的已略過。",
    "shortPart": "此份不足 {n} 頁",
    "dupName": "名稱重複，已自動加上編號"
  }
```

`en.json` 加對應：
```json
  "split": {
    "title": "Split",
    "modeCount": "Every N pages",
    "modeRanges": "Custom page ranges",
    "modeEach": "One file per page",
    "everyN": "Pages per file",
    "ranges": "Page ranges",
    "rangesHint": "Comma-separated, e.g. 1-3,4-8,9-12",
    "roster": "Class list (optional, one name per line)",
    "rosterHint": "Copy a column from Excel and paste it here. Leave blank to use the naming pattern below.",
    "pattern": "Naming pattern",
    "patternHint": "{n} becomes a zero-padded sequence number.",
    "preview": "Generate preview",
    "download": "Download ZIP",
    "colRange": "Pages",
    "colName": "Output filename",
    "willSplit": "Will produce {n} files",
    "rosterShort": "The list has {roster} names but {count} files will be produced. The rest use the naming pattern.",
    "rosterLong": "The list has {roster} names, more than the {count} files produced. The extras were ignored.",
    "shortPart": "This part has fewer than {n} pages",
    "dupName": "Duplicate name — a number was added"
  }
```

- [ ] **Step 2: 跑 i18n 一致性測試**

Run: `npm test`
Expected: PASS（`zh 同 en 的 key 完全一致` 依然綠）。若紅，代表兩份 json 有 key 對唔上。

- [ ] **Step 3: 寫 `tools/split.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>拆分 — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="split.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="split.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <div id="drop" class="dropzone" data-i18n="common.dropPdf"></div>
    <ul id="filelist" class="filelist"></ul>
    <p id="pagecount" class="hint"></p>
  </div>

  <div class="card">
    <label data-i18n="split.modeCount" style="margin-top:0"></label>
    <div class="radio-row">
      <label><input type="radio" name="mode" value="count" checked><span data-i18n="split.modeCount"></span></label>
      <label><input type="radio" name="mode" value="ranges"><span data-i18n="split.modeRanges"></span></label>
      <label><input type="radio" name="mode" value="each"><span data-i18n="split.modeEach"></span></label>
    </div>

    <div id="opt-count">
      <label data-i18n="split.everyN"></label>
      <input type="number" id="everyN" value="4" min="1" step="1">
    </div>

    <div id="opt-ranges" hidden>
      <label data-i18n="split.ranges"></label>
      <input type="text" id="ranges" placeholder="1-3,4-8,9-12">
      <p class="hint" data-i18n="split.rangesHint"></p>
    </div>

    <label data-i18n="split.roster"></label>
    <textarea id="roster" data-i18n-placeholder="split.roster"></textarea>
    <p class="hint" data-i18n="split.rosterHint"></p>

    <label data-i18n="split.pattern"></label>
    <input type="text" id="pattern" value="{n}">
    <p class="hint" data-i18n="split.patternHint"></p>

    <button id="preview" class="primary" data-i18n="split.preview"></button>
    <div id="msg" class="msg" hidden></div>
  </div>

  <div class="card" id="previewCard" hidden>
    <p id="summary"></p>
    <div style="max-height:26rem;overflow:auto">
      <table class="preview">
        <thead><tr>
          <th data-i18n="split.colRange"></th>
          <th data-i18n="split.colName"></th>
        </tr></thead>
        <tbody id="previewBody"></tbody>
      </table>
    </div>
    <button id="download" class="primary" data-i18n="split.download"></button>
  </div>
</div>

<script type="module">
import { initI18n, t, applyI18n } from '../assets/core/i18n.mjs';
import { createDropzone, renderFileList } from '../assets/core/dropzone.mjs';
import { loadPdf, newPdf, copyRange, save, AppError } from '../assets/core/pdf.mjs';
import { deliver } from '../assets/core/zip.mjs';
import { groupByCount, parseRanges, eachPage } from '../assets/core/paging.mjs';
import { parseRoster, buildNames } from '../assets/core/naming.mjs';

const $ = id => document.getElementById(id);
const msgEl = $('msg');
const show = (cls, key, vars) => {
  msgEl.className = `msg ${cls}`;
  msgEl.textContent = t(key, vars);
  msgEl.hidden = false;
};
const clearMsg = () => { msgEl.hidden = true; };

let doc = null;          // 已載入的 PDFDocument
let totalPages = 0;
let plan = null;         // {groups, names}

await initI18n();

const dz = createDropzone($('drop'), {
  accept: 'pdf', multiple: false,
  onChange: async (files, errKey) => {
    $('previewCard').hidden = true;
    plan = null;
    if (errKey) { show('error', errKey); return; }
    renderFileList($('filelist'), files, { onChange: f => { dz.files = f; } });
    if (files.length === 0) { doc = null; totalPages = 0; $('pagecount').textContent = ''; return; }
    try {
      clearMsg();
      doc = await loadPdf(files[0]);
      totalPages = doc.getPageCount();
      $('pagecount').textContent = t('common.pages', { n: totalPages });
    } catch (e) {
      doc = null; totalPages = 0; $('pagecount').textContent = '';
      show('error', e instanceof AppError ? e.i18nKey : 'error.corrupt');
    }
  },
});

document.querySelectorAll('input[name=mode]').forEach(r =>
  r.addEventListener('change', () => {
    const m = document.querySelector('input[name=mode]:checked').value;
    $('opt-count').hidden = m !== 'count';
    $('opt-ranges').hidden = m !== 'ranges';
    $('previewCard').hidden = true;
  })
);

function computeGroups() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  if (mode === 'each') return eachPage(totalPages);
  if (mode === 'ranges') return parseRanges($('ranges').value, totalPages);
  return groupByCount(totalPages, Number($('everyN').value));
}

$('preview').addEventListener('click', () => {
  if (!doc) { show('error', 'error.noFile'); return; }
  let groups;
  try {
    groups = computeGroups();
  } catch (e) {
    show('error', 'error.generic', { message: e.message });
    return;
  }
  const roster = parseRoster($('roster').value);
  const { items, unusedRoster } = buildNames({
    count: groups.length, roster, pattern: $('pattern').value,
  });
  plan = { groups, names: items };

  const nPer = Number($('everyN').value);
  const mode = document.querySelector('input[name=mode]:checked').value;
  const body = $('previewBody');
  body.innerHTML = '';
  groups.forEach((g, i) => {
    const it = items[i];
    const tr = document.createElement('tr');
    const short = mode === 'count' && (g.end - g.start + 1) < nPer;
    if (it.warning === 'duplicate') tr.className = 'dup';
    else if (short || it.warning === 'roster-short') tr.className = 'warn';

    const notes = [];
    if (short) notes.push(t('split.shortPart', { n: nPer }));
    if (it.warning === 'duplicate') notes.push(t('split.dupName'));

    const tdRange = document.createElement('td');
    tdRange.textContent = g.start === g.end ? `p.${g.start}` : `p.${g.start}-${g.end}`;
    const tdName = document.createElement('td');
    tdName.textContent = it.name + (notes.length ? `  ⚠ ${notes.join('；')}` : '');
    tr.append(tdRange, tdName);
    body.appendChild(tr);
  });

  const parts = [t('split.willSplit', { n: groups.length })];
  if (roster.length > 0 && roster.length < groups.length)
    parts.push(t('split.rosterShort', { roster: roster.length, count: groups.length }));
  if (unusedRoster.length > 0)
    parts.push(t('split.rosterLong', { roster: roster.length, count: groups.length }));
  $('summary').textContent = parts.join(' ');

  applyI18n();
  clearMsg();
  $('previewCard').hidden = false;
});

$('download').addEventListener('click', async () => {
  if (!plan || !doc) { show('error', 'error.noFile'); return; }
  const btn = $('download');
  btn.disabled = true;
  try {
    const outputs = [];
    for (let i = 0; i < plan.groups.length; i++) {
      const g = plan.groups[i];
      const out = await newPdf();
      await copyRange(doc, out, g.start, g.end);
      outputs.push({ name: plan.names[i].name, bytes: await save(out) });
      show('ok', 'common.processing', { done: i + 1, total: plan.groups.length });
      await new Promise(r => setTimeout(r, 0));
    }
    const base = (dz.files[0]?.name || 'split').replace(/\.pdf$/i, '');
    await deliver(outputs, `${base}_拆分.zip`);
    show('ok', 'common.done');
  } catch (e) {
    show('error', e instanceof AppError ? e.i18nKey : 'error.generic', { message: String(e.message) });
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 4: 準備 8 頁測試檔**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
npm i --no-save --no-audit --no-fund pdf-lib@1.17.1
node -e "
import('./node_modules/pdf-lib/dist/pdf-lib.esm.js').then(async ({PDFDocument, rgb}) => {
  const d = await PDFDocument.create();
  for (let i=1;i<=8;i++){ const p=d.addPage([595.28,841.89]); p.drawText('Page '+i,{x:60,y:700,size:48,color:rgb(0,0,0)}); }
  require('fs').writeFileSync('test-fixtures/sample-8p.pdf', await d.save());
  console.log('done');
});
"
rm -rf node_modules package-lock.json
ls -l test-fixtures/sample-8p.pdf
```

- [ ] **Step 5: 手動 smoke test**

起 server（`啟動PDF工具箱.bat`），開 `http://localhost:8010/tools/split.html`，逐項確認：

1. 拖入 `sample-8p.pdf` → 顯示「共 8 頁」
2. 每 4 頁 + 空名單 → 預覽表兩行：`p.1-4 → 1.pdf`、`p.5-8 → 2.pdf`
3. 名單貼「陳大文↵李小明」→ 預覽變 `陳大文.pdf`、`李小明.pdf`
4. 名單只貼「陳大文」→ 第二行標黃 + 摘要出現名單不足提示
5. 名單貼三個名 → 摘要出現「多餘已略過」
6. 名單貼「陳大文↵陳大文」→ 第二行標紅、檔名 `陳大文_2.pdf`
7. 每 3 頁 → 三行，最後一行 `p.7-8` 標黃「此份不足 3 頁」
8. 名單貼「5A/01 陳大文」→ 檔名變 `5A_01 陳大文.pdf`
9. 自訂範圍填 `1-3,4-8` → 兩行；填 `1-20` → 紅字越界錯誤
10. 逐頁模式 → 八行
11. 按下載 → 得到 ZIP，解開有正確份數，逐份頁數正確、內容對應原頁碼
12. 切英文 → 全頁英文，預覽表重新產生後亦係英文

- [ ] **Step 6: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/tools/split.html 100_Todo/pdf-toolbox/assets/i18n 100_Todo/pdf-toolbox/test-fixtures
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 拆分工具（每N頁/自訂範圍/逐頁 + 名單命名 + 預覽對照表）"
```

---

## Task 9: 合併工具

**Files:**
- Create: `tools/merge.html`
- Modify: `assets/i18n/zh.json`、`en.json`（加 `merge.*`）

**Interfaces:**
- Consumes: `mountTool`（Task 7）、`loadPdf` / `newPdf` / `copyRange` / `save`（Task 7）
- Produces: 無下游依賴

- [ ] **Step 1: 加 i18n keys**

`zh.json`：
```json
  "merge": {
    "title": "合併",
    "outName": "輸出檔名",
    "hint": "拖曳下方清單可調整合併次序。"
  }
```
`en.json`：
```json
  "merge": {
    "title": "Merge",
    "outName": "Output filename",
    "hint": "Drag the list below to change the merge order."
  }
```

- [ ] **Step 2: 跑 i18n 測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 寫 `tools/merge.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>合併 — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="merge.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="merge.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <div id="drop" class="dropzone" data-i18n="common.dropPdf"></div>
    <p class="hint" data-i18n="merge.hint"></p>
    <ul id="filelist" class="filelist"></ul>

    <label data-i18n="merge.outName"></label>
    <input type="text" id="outName" value="merged.pdf">

    <button id="run" class="primary" data-i18n="common.run"></button>
    <div id="msg" class="msg" hidden></div>
  </div>
</div>

<script type="module">
import { mountTool } from '../assets/core/toolpage.mjs';
import { loadPdf, newPdf, copyRange, save } from '../assets/core/pdf.mjs';
import { sanitizeFileName } from '../assets/core/naming.mjs';

await mountTool({
  dropEl: document.getElementById('drop'),
  listEl: document.getElementById('filelist'),
  runBtn: document.getElementById('run'),
  msgEl:  document.getElementById('msg'),
  accept: 'pdf', multiple: true, sortable: true,
  async run(files, ctx) {
    const out = await newPdf();
    for (let i = 0; i < files.length; i++) {
      const src = await loadPdf(files[i]);
      await copyRange(src, out, 1, src.getPageCount());
      ctx.progress(i + 1, files.length);
      await new Promise(r => setTimeout(r, 0));
    }
    const raw = document.getElementById('outName').value.replace(/\.pdf$/i, '');
    return [{ name: `${sanitizeFileName(raw)}.pdf`, bytes: await save(out) }];
  },
});
</script>
</body>
</html>
```

- [ ] **Step 4: 手動 smoke test**

開 `http://localhost:8010/tools/merge.html`：
1. 拖入 `sample-8p.pdf` 兩次 → 清單兩行
2. 拖曳第二行到第一行 → 次序對調
3. 按其中一行的「移除」→ 只剩一行
4. 重新加到兩個檔，按開始 → 下載單一 `merged.pdf`，開啟後 16 頁、頁序為 1-8 再 1-8
5. 拖入一個 `.docx` → 紅字「請拖入 PDF 檔」

- [ ] **Step 5: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/tools/merge.html 100_Todo/pdf-toolbox/assets/i18n
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 合併工具（可拖曳排序）"
```

---

## Task 10: 交錯合併工具

**Files:**
- Create: `tools/interleave.html`
- Modify: `assets/i18n/zh.json`、`en.json`（加 `interleave.*`）

**Interfaces:**
- Consumes: `interleave`（Task 4）、`loadPdf` / `newPdf` / `save` / `AppError`（Task 7）、`createDropzone` / `renderFileList`（Task 7）、`deliver`（Task 7）、`initI18n` / `t`（Task 6）
- Produces: 無下游依賴

本工具需要**兩個獨立 dropzone**（正面疊、背面疊），所以唔用 `mountTool` 嘅單 dropzone 外殼，直接用 `createDropzone`。

- [ ] **Step 1: 加 i18n keys**

`zh.json`：
```json
  "interleave": {
    "title": "交錯合併",
    "front": "正面那疊",
    "back": "背面那疊",
    "dropFront": "把正面掃描的 PDF 拖到這裡",
    "dropBack": "把背面掃描的 PDF 拖到這裡",
    "reverse": "背面是倒序（整疊反轉後掃描）",
    "reverseHint": "單面掃描器最常見的情況：掃完正面後把整疊反轉再掃，背面次序會是倒的。若你是逐張翻面掃描，請取消勾選。",
    "outName": "輸出檔名",
    "counts": "正面 {front} 頁、背面 {back} 頁，將合併成 {total} 頁。",
    "needBoth": "請先分別選擇正面與背面的 PDF。"
  }
```
`en.json`：
```json
  "interleave": {
    "title": "Interleave",
    "front": "Front side stack",
    "back": "Back side stack",
    "dropFront": "Drop the PDF of the scanned fronts here",
    "dropBack": "Drop the PDF of the scanned backs here",
    "reverse": "Backs are in reverse order (whole stack flipped)",
    "reverseHint": "The usual case with a single-sided scanner: you flip the whole stack after scanning the fronts, so the backs come out reversed. Uncheck this if you flipped each sheet individually.",
    "outName": "Output filename",
    "counts": "{front} front pages and {back} back pages will merge into {total} pages.",
    "needBoth": "Please choose both the front and the back PDF first."
  }
```

- [ ] **Step 2: 跑 i18n 測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 寫 `tools/interleave.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>交錯合併 — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="interleave.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="interleave.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <label style="margin-top:0" data-i18n="interleave.front"></label>
    <div id="dropFront" class="dropzone" data-i18n="interleave.dropFront"></div>
    <ul id="listFront" class="filelist"></ul>

    <label data-i18n="interleave.back"></label>
    <div id="dropBack" class="dropzone" data-i18n="interleave.dropBack"></div>
    <ul id="listBack" class="filelist"></ul>

    <div class="radio-row" style="margin-top:1rem">
      <label><input type="checkbox" id="reverse" checked><span data-i18n="interleave.reverse"></span></label>
    </div>
    <p class="hint" data-i18n="interleave.reverseHint"></p>

    <label data-i18n="interleave.outName"></label>
    <input type="text" id="outName" value="interleaved.pdf">

    <p id="counts" class="hint"></p>
    <button id="run" class="primary" data-i18n="common.run"></button>
    <div id="msg" class="msg" hidden></div>
  </div>
</div>

<script type="module">
import { initI18n, t } from '../assets/core/i18n.mjs';
import { createDropzone, renderFileList } from '../assets/core/dropzone.mjs';
import { loadPdf, newPdf, save, AppError } from '../assets/core/pdf.mjs';
import { deliver } from '../assets/core/zip.mjs';
import { interleave } from '../assets/core/paging.mjs';
import { sanitizeFileName } from '../assets/core/naming.mjs';

const $ = id => document.getElementById(id);
const msgEl = $('msg');
const show = (cls, key, vars) => {
  msgEl.className = `msg ${cls}`;
  msgEl.textContent = t(key, vars);
  msgEl.hidden = false;
};

await initI18n();

const docs = { front: null, back: null };

function makeZone(side, dropId, listId) {
  const dz = createDropzone($(dropId), {
    accept: 'pdf', multiple: false,
    onChange: async (files, errKey) => {
      if (errKey) { show('error', errKey); return; }
      renderFileList($(listId), files, { onChange: f => { dz.files = f; } });
      if (files.length === 0) { docs[side] = null; updateCounts(); return; }
      try {
        msgEl.hidden = true;
        docs[side] = await loadPdf(files[0]);
      } catch (e) {
        docs[side] = null;
        show('error', e instanceof AppError ? e.i18nKey : 'error.corrupt');
      }
      updateCounts();
    },
  });
  return dz;
}

function updateCounts() {
  const f = docs.front ? docs.front.getPageCount() : 0;
  const b = docs.back ? docs.back.getPageCount() : 0;
  $('counts').textContent = (f || b)
    ? t('interleave.counts', { front: f, back: b, total: f + b })
    : '';
}

const dzFront = makeZone('front', 'dropFront', 'listFront');
const dzBack  = makeZone('back',  'dropBack',  'listBack');

$('run').addEventListener('click', async () => {
  if (!docs.front || !docs.back) { show('error', 'interleave.needBoth'); return; }
  const btn = $('run');
  btn.disabled = true;
  try {
    const order = interleave(
      docs.front.getPageCount(),
      docs.back.getPageCount(),
      $('reverse').checked
    );
    const out = await newPdf();
    for (let i = 0; i < order.length; i++) {
      const { stack, index } = order[i];
      const [pg] = await out.copyPages(docs[stack], [index]);
      out.addPage(pg);
      if (i % 10 === 0 || i === order.length - 1) {
        show('ok', 'common.processing', { done: i + 1, total: order.length });
        await new Promise(r => setTimeout(r, 0));
      }
    }
    const raw = $('outName').value.replace(/\.pdf$/i, '');
    await deliver([{ name: `${sanitizeFileName(raw)}.pdf`, bytes: await save(out) }], 'interleaved.zip');
    show('ok', 'common.done');
  } catch (e) {
    show('error', e instanceof AppError ? e.i18nKey : 'error.generic', { message: String(e.message) });
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 4: 造兩個測試檔（正面 3 頁、背面 3 頁倒序）**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
npm i --no-save --no-audit --no-fund pdf-lib@1.17.1
node -e "
import('./node_modules/pdf-lib/dist/pdf-lib.esm.js').then(async ({PDFDocument, rgb}) => {
  const fs = require('fs');
  const mk = async (labels, path) => {
    const d = await PDFDocument.create();
    for (const l of labels) { const p = d.addPage([595.28,841.89]); p.drawText(l,{x:60,y:700,size:60,color:rgb(0,0,0)}); }
    fs.writeFileSync(path, await d.save());
  };
  await mk(['1','3','5'], 'test-fixtures/fronts.pdf');
  await mk(['6','4','2'], 'test-fixtures/backs-reversed.pdf');
  console.log('done');
});
"
rm -rf node_modules package-lock.json
```

- [ ] **Step 5: 手動 smoke test**

開 `http://localhost:8010/tools/interleave.html`：
1. 正面拖 `fronts.pdf`、背面拖 `backs-reversed.pdf`，勾住「背面倒序」→ 提示「正面 3 頁、背面 3 頁，將合併成 6 頁」
2. 按開始 → 輸出 PDF 六頁，內容依次為 **1 2 3 4 5 6**
3. 取消勾選倒序再跑 → 內容為 1 6 3 4 5 2（證明勾選有作用）
4. 只放正面就按開始 → 紅字「請先分別選擇正面與背面的 PDF」
5. 正面放 3 頁、背面放 `sample-8p.pdf`（8 頁）→ 合併 11 頁，唔會報錯

- [ ] **Step 6: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/tools/interleave.html 100_Todo/pdf-toolbox/assets/i18n 100_Todo/pdf-toolbox/test-fixtures
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 交錯合併工具（單面掃描器正反面咬合）"
```

---

## Task 11: 圖片轉 PDF 工具

**Files:**
- Create: `tools/images-to-pdf.html`
- Modify: `assets/i18n/zh.json`、`en.json`（加 `images.*`）
- Modify: `assets/core/pdf.mjs`（加 `embedImage`）
- Test: `tests/paging-fit.test.mjs`（新增純函式 `fitInto`）
- Modify: `assets/core/paging.mjs`（加 `fitInto`）

**Interfaces:**
- Consumes: `A4`（Task 5）、`mountTool`（Task 7）
- Produces:
  - `fitInto({srcW, srcH, boxW, boxH}) => {w, h, x, y, scale}` — 等比縮放並置中，Task 12/13/14 亦可能用到
  - `embedImage(doc, file) => Promise<PDFImage>`

- [ ] **Step 1: 寫 `fitInto` 的失敗測試**

`tests/paging-fit.test.mjs`：
```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `fitInto is not a function`

- [ ] **Step 3: 追加 `fitInto` 到 `paging.mjs` 尾部**

```js
export function fitInto({ srcW, srcH, boxW, boxH }) {
  for (const v of [srcW, srcH, boxW, boxH]) {
    if (!(v > 0)) throw new Error('尺寸必須為正數');
  }
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { w, h, x: (boxW - w) / 2, y: (boxH - h) / 2, scale };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 加 `embedImage` 到 `assets/core/pdf.mjs` 尾部**

```js
export async function embedImage(doc, file) {
  const bytes = await file.arrayBuffer();
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  try {
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    throw new AppError('error.notImage');
  }
}
```

- [ ] **Step 6: 加 i18n keys**

`zh.json`：
```json
  "images": {
    "title": "圖片轉 PDF",
    "hint": "拖曳下方清單可調整頁面次序。每張圖片會置中放在一版 A4 上。",
    "orient": "頁面方向",
    "auto": "依圖片自動判斷",
    "portrait": "直向 A4",
    "landscape": "橫向 A4",
    "outName": "輸出檔名"
  }
```
`en.json`：
```json
  "images": {
    "title": "Images to PDF",
    "hint": "Drag the list below to reorder pages. Each image is centred on one A4 sheet.",
    "orient": "Page orientation",
    "auto": "Match each image",
    "portrait": "A4 portrait",
    "landscape": "A4 landscape",
    "outName": "Output filename"
  }
```

- [ ] **Step 7: 寫 `tools/images-to-pdf.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>圖片轉 PDF — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="images.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="images.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <div id="drop" class="dropzone" data-i18n="common.dropImages"></div>
    <p class="hint" data-i18n="images.hint"></p>
    <ul id="filelist" class="filelist"></ul>

    <label data-i18n="images.orient"></label>
    <div class="radio-row">
      <label><input type="radio" name="orient" value="auto" checked><span data-i18n="images.auto"></span></label>
      <label><input type="radio" name="orient" value="portrait"><span data-i18n="images.portrait"></span></label>
      <label><input type="radio" name="orient" value="landscape"><span data-i18n="images.landscape"></span></label>
    </div>

    <label data-i18n="images.outName"></label>
    <input type="text" id="outName" value="images.pdf">

    <button id="run" class="primary" data-i18n="common.run"></button>
    <div id="msg" class="msg" hidden></div>
  </div>
</div>

<script type="module">
import { mountTool } from '../assets/core/toolpage.mjs';
import { newPdf, save, embedImage } from '../assets/core/pdf.mjs';
import { A4, fitInto } from '../assets/core/paging.mjs';
import { sanitizeFileName } from '../assets/core/naming.mjs';

const MARGIN = 20;   // pt，四邊留白

await mountTool({
  dropEl: document.getElementById('drop'),
  listEl: document.getElementById('filelist'),
  runBtn: document.getElementById('run'),
  msgEl:  document.getElementById('msg'),
  accept: 'image', multiple: true, sortable: true,
  async run(files, ctx) {
    const orient = document.querySelector('input[name=orient]:checked').value;
    const doc = await newPdf();
    for (let i = 0; i < files.length; i++) {
      const img = await embedImage(doc, files[i]);
      const landscape = orient === 'landscape'
        || (orient === 'auto' && img.width > img.height);
      const pw = landscape ? A4.H : A4.W;
      const ph = landscape ? A4.W : A4.H;
      const page = doc.addPage([pw, ph]);
      const fit = fitInto({
        srcW: img.width, srcH: img.height,
        boxW: pw - MARGIN * 2, boxH: ph - MARGIN * 2,
      });
      page.drawImage(img, {
        x: MARGIN + fit.x, y: MARGIN + fit.y, width: fit.w, height: fit.h,
      });
      ctx.progress(i + 1, files.length);
      await new Promise(r => setTimeout(r, 0));
    }
    const raw = document.getElementById('outName').value.replace(/\.pdf$/i, '');
    return [{ name: `${sanitizeFileName(raw)}.pdf`, bytes: await save(doc) }];
  },
});
</script>
</body>
</html>
```

- [ ] **Step 8: 手動 smoke test**

準備兩張測試圖（一直一橫）：
```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
node -e "
const fs=require('fs');
// 用 Chrome headless 截兩張純色圖太重，改用最小合法 PNG：直接放已有的任一張圖亦可
" 
```
若手上冇圖，用檔案總管把任意兩張手機相片（一直向一橫向）複製入 `test-fixtures/`。

開 `http://localhost:8010/tools/images-to-pdf.html`：
1. 拖入兩張圖 → 清單兩行、可拖曳對調
2. 方向選「依圖片自動判斷」→ 輸出 PDF 中橫圖那頁為橫向 A4、直圖那頁為直向 A4
3. 方向選「直向 A4」→ 兩頁皆直向，橫圖等比縮細並置中，不變形
4. 拖入一個 PDF → 紅字「請拖入 JPG 或 PNG 圖片」

- [ ] **Step 9: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/tools/images-to-pdf.html 100_Todo/pdf-toolbox/assets/core/paging.mjs 100_Todo/pdf-toolbox/assets/core/pdf.mjs 100_Todo/pdf-toolbox/assets/i18n 100_Todo/pdf-toolbox/tests/paging-fit.test.mjs
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 圖片轉 PDF（等比置中、A4 方向可選）"
```

---

## Task 12: 頁面編輯工具（縮圖、旋轉、刪除、重排）

**Files:**
- Create: `assets/core/thumbs.mjs`
- Create: `tools/organize.html`
- Modify: `assets/i18n/zh.json`、`en.json`（加 `organize.*`）

**Interfaces:**
- Consumes: `vendor/pdfjs/pdf.min.mjs`、`loadPdf` / `newPdf` / `save` / `PDFLib`（Task 7）
- Produces: `renderThumbs(file: File, container: HTMLElement, onReady) => Promise<void>` — 只此工具使用

**注意**：本頁係全站唯一載入 pdf.js 者。務必設定 `workerSrc` 同 `cMapUrl`，否則中文 PDF 縮圖會缺字。

- [ ] **Step 1: 加 i18n keys**

`zh.json`：
```json
  "organize": {
    "title": "頁面編輯",
    "hint": "拖曳縮圖可調整次序。按 ↻ 旋轉、按 ✕ 刪除（可再按一次還原）。",
    "rotate": "向右旋轉 90°",
    "toggleDelete": "刪除／還原",
    "rendering": "正在產生縮圖 {done} / {total}",
    "kept": "將輸出 {n} 頁",
    "allDeleted": "所有頁面都已標記刪除，請至少保留一頁。",
    "outName": "輸出檔名"
  }
```
`en.json`：
```json
  "organize": {
    "title": "Organize pages",
    "hint": "Drag thumbnails to reorder. Use ↻ to rotate and ✕ to delete (click again to restore).",
    "rotate": "Rotate 90° clockwise",
    "toggleDelete": "Delete / restore",
    "rendering": "Rendering thumbnails {done} / {total}",
    "kept": "{n} pages will be exported",
    "allDeleted": "Every page is marked for deletion — please keep at least one.",
    "outName": "Output filename"
  }
```

- [ ] **Step 2: 跑 i18n 測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 寫 `assets/core/thumbs.mjs`**

```js
// 全站唯一載入 pdf.js 的模組。
import * as pdfjs from '../../vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const CMAP_URL = new URL('../../vendor/pdfjs/cmaps/', import.meta.url).href;

const THUMB_WIDTH = 160;   // css px

export async function renderThumbs(file, onPage, onProgress = () => {}) {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  }).promise;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    onPage(i - 1, canvas);
    onProgress(i, doc.numPages);
    await new Promise(r => setTimeout(r, 0));
  }
  return doc.numPages;
}
```

- [ ] **Step 4: 寫 `tools/organize.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>頁面編輯 — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="organize.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="organize.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <div id="drop" class="dropzone" data-i18n="common.dropPdf"></div>
    <ul id="filelist" class="filelist"></ul>
    <p class="hint" data-i18n="organize.hint"></p>
    <div id="thumbs" class="thumbs"></div>
    <p id="kept" class="hint"></p>

    <label data-i18n="organize.outName"></label>
    <input type="text" id="outName" value="organized.pdf">

    <button id="run" class="primary" data-i18n="common.run"></button>
    <div id="msg" class="msg" hidden></div>
  </div>
</div>

<script type="module">
import { initI18n, t } from '../assets/core/i18n.mjs';
import { createDropzone, renderFileList } from '../assets/core/dropzone.mjs';
import { loadPdf, newPdf, save, PDFLib, AppError } from '../assets/core/pdf.mjs';
import { deliver } from '../assets/core/zip.mjs';
import { renderThumbs } from '../assets/core/thumbs.mjs';
import { sanitizeFileName } from '../assets/core/naming.mjs';

const $ = id => document.getElementById(id);
const msgEl = $('msg');
const show = (cls, key, vars) => {
  msgEl.className = `msg ${cls}`;
  msgEl.textContent = t(key, vars);
  msgEl.hidden = false;
};

await initI18n();

let srcDoc = null;
let state = [];   // [{origIndex, rotate, removed, canvas}]

function repaint() {
  const box = $('thumbs');
  box.innerHTML = '';
  state.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'thumb' + (s.removed ? ' removed' : '');
    div.draggable = true;
    div.dataset.index = String(i);

    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = String(i + 1);

    s.canvas.style.transform = `rotate(${s.rotate}deg)`;
    s.canvas.style.transition = 'transform .15s';

    const acts = document.createElement('div');
    acts.className = 'acts';
    const rot = document.createElement('button');
    rot.type = 'button'; rot.textContent = '↻'; rot.title = t('organize.rotate');
    rot.addEventListener('click', e => { e.stopPropagation(); s.rotate = (s.rotate + 90) % 360; repaint(); });
    const del = document.createElement('button');
    del.type = 'button'; del.textContent = s.removed ? '↺' : '✕'; del.title = t('organize.toggleDelete');
    del.addEventListener('click', e => { e.stopPropagation(); s.removed = !s.removed; repaint(); });
    acts.append(rot, del);

    div.append(no, s.canvas, acts);
    box.appendChild(div);
  });
  $('kept').textContent = t('organize.kept', { n: state.filter(s => !s.removed).length });
}

let dragFrom = null;
$('thumbs').addEventListener('dragstart', e => {
  const d = e.target.closest('.thumb');
  if (!d) return;
  dragFrom = Number(d.dataset.index);
  d.classList.add('dragging');
});
$('thumbs').addEventListener('dragend', e => e.target.closest('.thumb')?.classList.remove('dragging'));
$('thumbs').addEventListener('dragover', e => e.preventDefault());
$('thumbs').addEventListener('drop', e => {
  e.preventDefault();
  const d = e.target.closest('.thumb');
  if (!d || dragFrom === null) return;
  const to = Number(d.dataset.index);
  state.splice(to, 0, state.splice(dragFrom, 1)[0]);
  dragFrom = null;
  repaint();
});

const dz = createDropzone($('drop'), {
  accept: 'pdf', multiple: false,
  onChange: async (files, errKey) => {
    if (errKey) { show('error', errKey); return; }
    renderFileList($('filelist'), files, { onChange: f => { dz.files = f; } });
    $('thumbs').innerHTML = ''; state = []; srcDoc = null; $('kept').textContent = '';
    if (files.length === 0) return;
    try {
      msgEl.hidden = true;
      srcDoc = await loadPdf(files[0]);
      const pending = [];
      await renderThumbs(
        files[0],
        (i, canvas) => pending.push({ origIndex: i, rotate: 0, removed: false, canvas }),
        (done, total) => show('ok', 'organize.rendering', { done, total })
      );
      state = pending;
      msgEl.hidden = true;
      repaint();
    } catch (e) {
      show('error', e instanceof AppError ? e.i18nKey : 'error.corrupt');
    }
  },
});

$('run').addEventListener('click', async () => {
  if (!srcDoc) { show('error', 'error.noFile'); return; }
  const kept = state.filter(s => !s.removed);
  if (kept.length === 0) { show('error', 'organize.allDeleted'); return; }
  const btn = $('run');
  btn.disabled = true;
  try {
    const out = await newPdf();
    const pages = await out.copyPages(srcDoc, kept.map(s => s.origIndex));
    pages.forEach((pg, i) => {
      const extra = kept[i].rotate;
      if (extra) {
        const base = pg.getRotation().angle;
        pg.setRotation(PDFLib.degrees((base + extra) % 360));
      }
      out.addPage(pg);
    });
    const raw = $('outName').value.replace(/\.pdf$/i, '');
    await deliver([{ name: `${sanitizeFileName(raw)}.pdf`, bytes: await save(out) }], 'organized.zip');
    show('ok', 'common.done');
  } catch (e) {
    show('error', e instanceof AppError ? e.i18nKey : 'error.generic', { message: String(e.message) });
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 5: 手動 smoke test**

開 `http://localhost:8010/tools/organize.html`：
1. 拖入 `sample-8p.pdf` → 見八張縮圖，數字 1-8，內容分別為 Page 1…Page 8
2. 開 DevTools Console → **不得有 pdf.js worker 或 cmap 的 404**（若有，代表 Task 1 的 vendor 複製漏咗）
3. 按第 3 張的 ↻ 兩次 → 該縮圖轉 180°
4. 按第 5 張的 ✕ → 變半透明，下方「將輸出 7 頁」
5. 再按一次 ↺ → 還原，「將輸出 8 頁」
6. 把第 1 張拖到最尾 → 編號重排
7. 刪走 5、6、7、8 後按開始 → 輸出四頁，內容與次序符合畫面
8. 全部刪走再按開始 → 紅字「所有頁面都已標記刪除」
9. 轉 180° 那頁在輸出 PDF 中確實倒轉

- [ ] **Step 6: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/assets/core/thumbs.mjs 100_Todo/pdf-toolbox/tools/organize.html 100_Todo/pdf-toolbox/assets/i18n
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 頁面編輯（pdf.js 縮圖、旋轉、刪除、拖曳重排）"
```

---

## Task 13: N-up 拼版工具

**Files:**
- Create: `tools/nup.html`
- Modify: `assets/i18n/zh.json`、`en.json`（加 `nup.*`）

**Interfaces:**
- Consumes: `nupLayout`（Task 5）、`mountTool`（Task 7）、`loadPdf` / `newPdf` / `save`（Task 7）
- Produces: 無下游依賴

用 pdf-lib 的 `embedPage()` + `page.drawPage()` 把來源頁當成圖形嵌入新版面。

- [ ] **Step 1: 加 i18n keys**

`zh.json`：
```json
  "nup": {
    "title": "N-up 拼版",
    "per": "每版頁數",
    "per2": "2 頁一版（橫向 A4）",
    "per4": "4 頁一版（直向 A4）",
    "gutter": "頁間留白（pt）",
    "gutterHint": "1 pt 約等於 0.35 毫米。預設 10 pt。",
    "outName": "輸出檔名",
    "sheets": "{pages} 頁將拼成 {sheets} 版。"
  }
```
`en.json`：
```json
  "nup": {
    "title": "N-up",
    "per": "Pages per sheet",
    "per2": "2 per sheet (A4 landscape)",
    "per4": "4 per sheet (A4 portrait)",
    "gutter": "Gap between pages (pt)",
    "gutterHint": "1 pt is about 0.35 mm. Default is 10 pt.",
    "outName": "Output filename",
    "sheets": "{pages} pages will fit onto {sheets} sheets."
  }
```

- [ ] **Step 2: 跑 i18n 測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 寫 `tools/nup.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>N-up 拼版 — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="nup.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="nup.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <div id="drop" class="dropzone" data-i18n="common.dropPdf"></div>
    <ul id="filelist" class="filelist"></ul>

    <label data-i18n="nup.per"></label>
    <div class="radio-row">
      <label><input type="radio" name="per" value="2" checked><span data-i18n="nup.per2"></span></label>
      <label><input type="radio" name="per" value="4"><span data-i18n="nup.per4"></span></label>
    </div>

    <label data-i18n="nup.gutter"></label>
    <input type="number" id="gutter" value="10" min="0" step="1">
    <p class="hint" data-i18n="nup.gutterHint"></p>

    <label data-i18n="nup.outName"></label>
    <input type="text" id="outName" value="nup.pdf">

    <button id="run" class="primary" data-i18n="common.run"></button>
    <div id="msg" class="msg" hidden></div>
  </div>
</div>

<script type="module">
import { mountTool } from '../assets/core/toolpage.mjs';
import { loadPdf, newPdf, save } from '../assets/core/pdf.mjs';
import { nupLayout } from '../assets/core/paging.mjs';
import { sanitizeFileName } from '../assets/core/naming.mjs';

await mountTool({
  dropEl: document.getElementById('drop'),
  listEl: document.getElementById('filelist'),
  runBtn: document.getElementById('run'),
  msgEl:  document.getElementById('msg'),
  accept: 'pdf', multiple: false,
  async run(files, ctx) {
    const per = Number(document.querySelector('input[name=per]:checked').value);
    const gutter = Math.max(0, Number(document.getElementById('gutter').value) || 0);

    const src = await loadPdf(files[0]);
    const total = src.getPageCount();
    const out = await newPdf();

    // 逐版處理：一版最多 per 頁
    for (let start = 0; start < total; start += per) {
      const indices = [];
      for (let k = 0; k < per && start + k < total; k++) indices.push(start + k);

      const embedded = await out.embedPages(indices.map(i => src.getPage(i)));
      const first = src.getPage(indices[0]);
      const { width: pw, height: ph } = first.getSize();
      const layout = nupLayout({ pageW: pw, pageH: ph, per, gutter });
      const sheet = out.addPage([layout.sheetW, layout.sheetH]);

      embedded.forEach((ep, k) => {
        // 每頁尺寸可能不同，故逐頁按其實際尺寸重算縮放，但沿用該格的位置
        const cell = layout.cells[k];
        const s = Math.min(cell.w / ep.width, cell.h / ep.height);
        const w = ep.width * s;
        const h = ep.height * s;
        sheet.drawPage(ep, {
          x: cell.x + (cell.w - w) / 2,
          y: cell.y + (cell.h - h) / 2,
          xScale: s, yScale: s,
        });
      });

      ctx.progress(Math.min(start + per, total), total);
      await new Promise(r => setTimeout(r, 0));
    }

    const raw = document.getElementById('outName').value.replace(/\.pdf$/i, '');
    return [{ name: `${sanitizeFileName(raw)}.pdf`, bytes: await save(out) }];
  },
});
</script>
</body>
</html>
```

- [ ] **Step 4: 手動 smoke test**

開 `http://localhost:8010/tools/nup.html`：
1. 拖入 `sample-8p.pdf`，選 2 頁一版 → 輸出 4 版，每版橫向，左邊 Page 1 右邊 Page 2，如此類推
2. 選 4 頁一版 → 輸出 2 版，每版直向，左上 1、右上 2、左下 3、右下 4
3. 頁間留白改 0 → 頁面貼得更近，內容不重疊
4. 頁間留白改 40 → 內容縮細、間距明顯
5. 造一份 7 頁的檔（用拆分工具由 8 頁檔取 p.1-7）→ 4 頁一版時第 2 版只有 3 頁，右下留空、不報錯
6. 內容不得變形（長寬比與原頁一致）

- [ ] **Step 5: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/tools/nup.html 100_Todo/pdf-toolbox/assets/i18n
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): N-up 拼版（2/4 頁一版，等比置中不變形）"
```

---

## Task 14: 批改留白工具

**Files:**
- Create: `tools/margin.html`
- Modify: `assets/i18n/zh.json`、`en.json`（加 `margin.*`）

**Interfaces:**
- Consumes: `marginEdge`（Task 5）、`mountTool`（Task 7）、`loadPdf` / `newPdf` / `save` / `PDFLib`（Task 7）
- Produces: 無下游依賴

**做法**：把每頁 `embedPage` 入一版更大的新頁。相比直接改 mediabox，此法對有 `/Rotate`、非零原點 mediabox 的頁面都穩陣。`marginEdge` 用嚟決定新頁邊要加喺 mediabox 哪一側。

- [ ] **Step 1: 加 i18n keys**

`zh.json`：
```json
  "margin": {
    "title": "批改留白",
    "edge": "留白位置",
    "right": "右邊",
    "bottom": "下邊",
    "size": "留白闊度（毫米）",
    "sizeHint": "預設 40 毫米，約等於一般評語欄的闊度。",
    "outName": "輸出檔名",
    "rotateNote": "已旋轉的頁面會自動對應到你看到的那一邊。"
  }
```
`en.json`：
```json
  "margin": {
    "title": "Marking margin",
    "edge": "Where to add space",
    "right": "Right edge",
    "bottom": "Bottom edge",
    "size": "Margin width (mm)",
    "sizeHint": "40 mm by default — about the width of a typical comment column.",
    "outName": "Output filename",
    "rotateNote": "Rotated pages are handled so the margin lands on the edge you actually see."
  }
```

- [ ] **Step 2: 跑 i18n 測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 寫 `tools/margin.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>批改留白 — PDF 工具箱</title>
<link rel="stylesheet" href="../assets/css/design.css">
<script src="../vendor/jszip.min.js"></script>
</head>
<body data-title-key="margin.title">
<div class="wrap">
  <header class="site">
    <h1 data-i18n="margin.title"></h1>
    <div>
      <a href="../index.html" data-i18n="app.backToHub"></a>
      <button id="lang-toggle" class="secondary" style="margin:0 0 0 1rem;padding:.4rem .8rem" data-i18n="app.langToggle"></button>
    </div>
  </header>
  <p class="privacy" data-i18n="app.privacy"></p>

  <div class="card">
    <div id="drop" class="dropzone" data-i18n="common.dropPdf"></div>
    <ul id="filelist" class="filelist"></ul>

    <label data-i18n="margin.edge"></label>
    <div class="radio-row">
      <label><input type="radio" name="edge" value="right" checked><span data-i18n="margin.right"></span></label>
      <label><input type="radio" name="edge" value="bottom"><span data-i18n="margin.bottom"></span></label>
    </div>
    <p class="hint" data-i18n="margin.rotateNote"></p>

    <label data-i18n="margin.size"></label>
    <input type="number" id="size" value="40" min="1" step="1">
    <p class="hint" data-i18n="margin.sizeHint"></p>

    <label data-i18n="margin.outName"></label>
    <input type="text" id="outName" value="margin.pdf">

    <button id="run" class="primary" data-i18n="common.run"></button>
    <div id="msg" class="msg" hidden></div>
  </div>
</div>

<script type="module">
import { mountTool } from '../assets/core/toolpage.mjs';
import { loadPdf, newPdf, save } from '../assets/core/pdf.mjs';
import { marginEdge } from '../assets/core/paging.mjs';
import { sanitizeFileName } from '../assets/core/naming.mjs';

const MM_TO_PT = 72 / 25.4;

await mountTool({
  dropEl: document.getElementById('drop'),
  listEl: document.getElementById('filelist'),
  runBtn: document.getElementById('run'),
  msgEl:  document.getElementById('msg'),
  accept: 'pdf', multiple: false,
  async run(files, ctx) {
    const visualEdge = document.querySelector('input[name=edge]:checked').value;
    const pad = Math.max(1, Number(document.getElementById('size').value) || 40) * MM_TO_PT;

    const src = await loadPdf(files[0]);
    const total = src.getPageCount();
    const out = await newPdf();

    for (let i = 0; i < total; i++) {
      const srcPage = src.getPage(i);
      const rotation = srcPage.getRotation().angle;
      const edge = marginEdge(visualEdge, rotation);
      const { width: w, height: h } = srcPage.getSize();

      const grow = { right: [pad, 0], left: [pad, 0], top: [0, pad], bottom: [0, pad] }[edge];
      const newW = w + grow[0];
      const newH = h + grow[1];

      // 內容要擺喺「唔加白」嗰邊：left/bottom 加白時，內容要推開
      const offsetX = edge === 'left' ? pad : 0;
      const offsetY = edge === 'bottom' ? pad : 0;

      const embedded = await out.embedPage(srcPage);
      const page = out.addPage([newW, newH]);
      page.drawPage(embedded, { x: offsetX, y: offsetY, xScale: 1, yScale: 1 });
      // 保留原本的顯示旋轉，令用戶睇到嘅方向唔變
      page.setRotation(srcPage.getRotation());

      ctx.progress(i + 1, total);
      await new Promise(r => setTimeout(r, 0));
    }

    const raw = document.getElementById('outName').value.replace(/\.pdf$/i, '');
    return [{ name: `${sanitizeFileName(raw)}.pdf`, bytes: await save(out) }];
  },
});
</script>
</body>
</html>
```

- [ ] **Step 4: 造一份含旋轉頁的測試檔**

```bash
cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox
npm i --no-save --no-audit --no-fund pdf-lib@1.17.1
node -e "
import('./node_modules/pdf-lib/dist/pdf-lib.esm.js').then(async ({PDFDocument, rgb, degrees}) => {
  const d = await PDFDocument.create();
  const angles = [0, 90, 180, 270];
  angles.forEach(a => {
    const p = d.addPage([595.28, 841.89]);
    p.drawText('rot ' + a, { x: 60, y: 700, size: 48, color: rgb(0,0,0) });
    p.setRotation(degrees(a));
  });
  require('fs').writeFileSync('test-fixtures/rotated-4p.pdf', await d.save());
  console.log('done');
});
"
rm -rf node_modules package-lock.json
```

- [ ] **Step 5: 手動 smoke test**

開 `http://localhost:8010/tools/margin.html`：
1. 拖入 `sample-8p.pdf`，右邊留白 40mm → 八頁，每頁右邊多出約 4cm 空白，原內容不縮細、不變形
2. 改下邊留白 → 空白出現喺下方
3. 留白改 10mm → 明顯較窄
4. 拖入 `rotated-4p.pdf`，右邊留白 → **在 PDF 閱讀器中檢視，四頁的空白都在畫面右邊**（呢個係 `marginEdge` 的實際驗證；若某頁空白跑咗去上／下／左，代表旋轉映射有錯）
5. 下邊留白配 `rotated-4p.pdf` → 四頁空白都在畫面下方

- [ ] **Step 6: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/tools/margin.html 100_Todo/pdf-toolbox/assets/i18n 100_Todo/pdf-toolbox/test-fixtures
git diff --cached --name-only
git commit -m "feat(pdf-toolbox): 批改留白（右/下邊，正確處理已旋轉頁面）"
```

---

## Task 15: 文件、全站回歸、收尾

**Files:**
- Create: `README.md`
- Create: `docs/progress.md`
- Test: 全站手動回歸

**Interfaces:**
- Consumes: 前面全部 task
- Produces: 專案文件；`docs/progress.md` 經 junction 出現喺 `200_Obsidian/202_Project/pdf-toolbox/`

- [ ] **Step 1: 跑全部自動化測試**

Run: `cd /d/AI_AGENT/claude/100_Todo/pdf-toolbox && npm test`
Expected: PASS，全部測試綠，**並且測試數目大於 0**（若見 `MODULE_NOT_FOUND` 即 test script 被改壞）。

- [ ] **Step 2: 全站回歸**

起 server，由 `index.html` 逐個入口撳入去，確認：
1. 七張卡全部連得通，冇 404
2. 每頁的「返回工具箱」返到 hub
3. 語言切換喺任何一頁按都生效，跳去另一頁後保持該語言
4. 每頁頂部都有隱私聲明
5. DevTools Network 分頁：**除同源檔案外冇任何對外請求**
6. DevTools Console：冇 error（pdf.js 的 info 級訊息可接受）

- [ ] **Step 3: 寫 `README.md`**

```markdown
# PDF 工具箱

本地 PDF 處理工具，專為教師而設。所有處理在瀏覽器內完成，檔案不會上傳到任何伺服器。

## 啟動

雙擊 `啟動PDF工具箱.bat`，瀏覽器會自動開啟 `http://localhost:8010/`。
用完雙擊 `關閉PDF工具箱.bat`。

**Port：8010**（8000 已由 DSE-PP-Database 使用）。

## 七個工具

| 工具 | 用途 |
| :--- | :--- |
| 拆分 | 一疊掃描功課，每 N 頁自動拆成一份，並依班別名單命名 |
| 合併 | 把多份 PDF 依指定次序併成一份 |
| 交錯合併 | 單面掃描器分開掃正反面後，咬合成正確頁序 |
| 圖片轉 PDF | 把多張相片或截圖合成一份 A4 PDF |
| 頁面編輯 | 以縮圖檢視全部頁面，旋轉、刪除、重新排序 |
| N-up 拼版 | 把 2 或 4 頁併成一版 A4，列印時節省紙張 |
| 批改留白 | 每頁加上空白邊，方便手寫評語 |

## 技術

純靜態網站，無後端、無 build step。依賴 `pdf-lib`、`pdf.js`、`JSZip`，三者皆以實體檔案存放於 `vendor/`，不使用 CDN。

## 測試

```bash
npm test        # 即 node --test，不可帶路徑參數（Node 24 會 MODULE_NOT_FOUND）
```

自動化測試只覆蓋純計算模組（分頁分組、檔名處理、交錯順序、版面計算）。PDF 實際輸出以 `test-fixtures/` 內的樣本檔手動驗證。

## 尚未支援

OCR、檔案壓縮、PDF 轉 Word、加密解密、浮水印、頁碼頁眉、小冊子排版。前三者需要後端或重量級 wasm，與「零後端」定位衝突；其餘為 v1 刻意排除，非遺漏。

## 設計

視覺依專案根目錄 `DESIGN.md`（edu-light）。修改 UI 前請先閱讀。

## 規格與計畫

- 設計規格：`docs/specs/2026-08-07-pdf-toolbox-design.md`
- 實作計畫：`docs/plans/2026-08-07-pdf-toolbox.md`
```

- [ ] **Step 4: 寫 `docs/progress.md`**

```markdown
# PDF 工具箱 — 進度

## 現況

v1 完成：七個工具全部可用，本機 port 8010。純靜態、零後端、檔案不離開瀏覽器。

## 已完成

- [x] 專案骨架、vendor 三庫、啟動／關閉 BAT
- [x] `paging.mjs` 分組與範圍解析（含單元測試）
- [x] `naming.mjs` 檔名、名單、pattern（含單元測試）
- [x] `paging.mjs` 交錯合併頁序（含單元測試）
- [x] `paging.mjs` N-up 版面與旋轉邊對應（含單元測試）
- [x] edu-light 樣式、中英 i18n、hub 入口頁
- [x] 瀏覽器共用層（pdf / zip / dropzone / toolpage）
- [x] 拆分工具（招牌功能，兩段式預覽）
- [x] 合併工具
- [x] 交錯合併工具
- [x] 圖片轉 PDF
- [x] 頁面編輯（pdf.js 縮圖）
- [x] N-up 拼版
- [x] 批改留白
- [x] README、全站回歸

## 未做（刻意排除，非遺漏）

- [ ] 公開部署到 GitHub Pages —— 需要 Lonely SIR 批准後才加 remote / push
- [ ] OCR、檔案壓縮、PDF 轉 Word —— 需要後端，與零後端定位衝突
- [ ] 小冊子 booklet 排版、統一頁面尺寸 —— v2 再評估
- [ ] CSV / Excel 名單上傳 —— 貼文字已足夠，加 SheetJS 不划算

## 日誌

- 2026-08-07 — 完成 brainstorming，寫定設計規格與實作計畫。
```

- [ ] **Step 5: 確認 junction 通**

Run:
```bash
ls /d/AI_AGENT/claude/200_Obsidian/202_Project/pdf-toolbox/
```
Expected: 見到 `progress.md`、`plans/`、`specs/`（即 Task 1 Step 11 建的 junction 生效）。若見唔到，重跑該步。

- [ ] **Step 6: Commit**

```bash
cd /d/AI_AGENT/claude
git add 100_Todo/pdf-toolbox/README.md 100_Todo/pdf-toolbox/docs/progress.md
git diff --cached --name-only
git commit -m "docs(pdf-toolbox): README 與 progress，v1 七個工具完成"
```

---

## Self-Review 記錄

**Spec coverage** — 逐節對照 `2026-08-07-pdf-toolbox-design.md`：

| Spec 章節 | 對應 Task |
| :--- | :--- |
| §2 架構、檔案結構 | 1, 6, 7 |
| §2.2 vendor 本地化 | 1 |
| §2.3 模組邊界 | 2, 3, 4, 5, 7, 12 |
| §2.4 雙語 | 6（機制）＋ 8-14（各自增補 keys） |
| §3 七個工具 | 8, 9, 10, 11, 12, 13, 14 |
| §3.1 拆分流程與命名規則 | 3（邏輯）＋ 8（介面） |
| §4 資料流、隱私聲明、進度讓步 | 6（聲明文案）、7（deliver / yieldToUI）、8-14（逐個 tool 落實） |
| §5 錯誤處理逐個 case | 7（`AppError` 與訊息映射）＋ 6（error.* 文案）＋ 8-14（各自呼叫） |
| §6.1 自動化測試五類 | 2, 3, 4, 5, 11 |
| §6.2 手動 smoke test | 8-14 各自的 smoke step ＋ 15 全站回歸 |
| §7 視覺 edu-light | 1（複製 DESIGN.md）＋ 6（design.css） |
| §8.1 docs junction | 1 Step 11、15 Step 5 |
| §8.2 BAT 與 port 8010 | 1 |
| §8.3 公開 host | 15（明確標為未做、需 SIR 批准） |
| §9 範圍界線 | 15 progress.md 的「未做」區 |

無遺漏。

**Placeholder scan** — 全文無 TBD / TODO / 「similar to Task N」/「加上適當的錯誤處理」。每個 code step 都有完整可貼上的程式碼。

**Type consistency** — 已核對：`{start, end}` 在 Task 2/8 一致；`buildNames` 回傳 `{items, unusedRoster}` 在 Task 3/8 一致；`items[i].warning` 的三個值 `null`/`'roster-short'`/`'duplicate'` 在 Task 3/8 一致；`interleave` 回傳 `{stack, index}` 在 Task 4/10 一致；`nupLayout` 回傳 `{sheetW, sheetH, cells}` 在 Task 5/13 一致；`fitInto` 回傳 `{w,h,x,y,scale}` 在 Task 11 一致；`AppError.i18nKey` 在 Task 7 定義、8-14 使用一致；`ctx.progress(done, total)` 在 Task 7 定義、9/11/13/14 使用一致。

**發現並已修正**：

1. Task 13 原本直接用 `layout.cells[k]` 的 `w/h/scale`，但 `nupLayout` 只按第一頁尺寸計算，遇上頁面尺寸不一的 PDF 會變形 —— 已改為在 `drawPage` 時按每頁實際尺寸重算縮放，只沿用格位。
2. **（執行期間發現，2026-08-09 修正）** Task 3 原本的 `buildNames` 參考實作以「加後綴之前」的 `base` 做去重 key，`seen` map 從不檢查算出來的最終名是否已被用過。名單 `['王小明', '王小明_2']`（老師自己預先分身的兩個同名學生，用的正是這段碼自己會生成的寫法）會產生兩個 `王小明_2.pdf`，而第二個的 `warning` 竟是 `null`。ZIP 內後者靜默覆蓋前者 —— 一份功課消失且畫面無任何提示。已改為**以最終檔名做碰撞判斷，且後綴只加不減**：不碰撞的名一律原樣輸出、`warning` 為 `null`；只有真碰撞才加 `_2`/`_3` 直到空位。上方測試已補三個回歸案例與一條「絕不可有兩個同名輸出」的不變式測試。

3. **（執行期間發現，2026-08-09 修正）** Task 5 的 `marginEdge` **實作與測試互相矛盾**：參考實作 `(i - steps + 4) % 4` 正確，但測試斷言 `marginEdge('right', 90) === 'bottom'` 是錯的（正確為 `'top'`）。實作者察覺矛盾後選擇相信測試，反過來把正確的實作改成 `(i + steps) % 4`，令整個映射反轉。後果：Task 14 會把批改留白加到旋轉頁的相反邊，壓住學生的作答，而輸出頁數正常、外觀無異，難以察覺。**0° 與 180° 之下正確映射與其反向映射結果相同**，故錯誤在整套對照表下隱形。已更正測試表，並補一條 round-trip 不變式測試釘死方向。教訓：幾何／方向類程式碼的自我檢查，不可拿自己的實作驗自己的算術——自洽不等於正確。

4. Task 7 Step 5 原本用 `vm.SourceTextModule`，需要 `--experimental-vm-modules`，會迫使 `package.json` 的 test script 改成 `node --test --experimental-vm-modules`，與 Task 1 smoke test 斷言 `=== 'node --test'` 直接衝突 —— 已改用 `node --check`（實測於 Node v24.14.1：支援 .mjs、支援 top-level await、不解析 import、無需 flag）。

5. **（執行期間發現，2026-08-12 修正／Task 15 收尾時補記）** Task 6 落地時同下筆計畫有三處分別，實作者當時判斷為順手修正、冇特登記錄，Task 15 全站回歸時對照返計畫先發現文件同代碼唔一致：
   - `i18n.mjs` 嘅 `load()` 原本冇包 `try/catch`：`fetch` 失敗（例如用戶用緊嘅瀏覽器擴充功能擋咗本地檔案請求、或者少見嘅檔案系統問題令 `file://`／`http-server` 讀唔到 json）會令 `initI18n()` 個 `await` 永遠唔 resolve，成頁靜靜雞卡死，冇任何訊息。已加 `try/catch` 同 `showLoadError()`，失敗時喺畫面頂部釘死一句雙語（`t()` 呢個時候本身用唔到，雞先定蛋先）嘅錯誤橫幅，並喺下次成功 `load()` 時自動移除。
   - `design.css` 原本淨係有 `-50`／`-500`／`-600` 呢幾級色階，`.privacy` 同 `.msg.*` 直接攞 `-600` 或者寫死 `#065f46` 做文字色，冇專門計過喺對應嘅 `-50` 淺色底上嘅對比度。已加 `--success-800`／`--warning-800`／`--error-800` 三個較深色階（並喺旁邊寫低量得嘅對比值），全部達 WCAG AA 4.5:1，`.privacy`／`.msg.error`／`.msg.ok`／`.msg.warn` 改用呢幾個新 token。
   - `body` 嘅 `font-family` 原本尾段有 `"Noto Sans TC"`，但 `vendor/` 從未帶呢隻字型嘅檔案（本專案「唔用 CDN、三個 vendor 庫全部本機」嘅定位下，字型都應該同一套原則），寫死喺 stack 入面只會喺冇裝呢隻字嘅裝置（例如非香港/台灣 Windows 預設語言包）靜靜雞跌落後面嘅 fallback，且容易俾人誤會呢個 project 依賴一隻冇隨附嘅字型。已拎走呢一段，保留 `Inter, system-ui, sans-serif`。

   三處都已經喺 Task 6 Step 5／Step 6 嘅程式碼區塊同步更新做實際落地版本，並喺區塊上方加咗更新註記。教訓：Task 6 之後的每個 task 都係直接讀緊 `assets/css/design.css`／`assets/core/i18n.mjs` 呢兩個檔案本身（唔係計畫入面嗰份程式碼）嚟寫，所以行為冇受影響；純粹係計畫文件本身滯後於實作，變成一份唔可靠嘅「事後查閱」記錄——收尾階段一併對齊。

**已實測驗證的外部事實**（寫計畫時在本機確認，非憑記憶）：

- Node `v24.14.1`、npm `11.11.0`；port 8010 未被佔用
- `pdf-lib@1.17.1` 有 `dist/pdf-lib.esm.min.js`（512K），`PDFDocument.prototype` 具備 `embedPage` / `embedPages` / `copyPages`，且 export `degrees`
- `pdfjs-dist@6.2.108` 的 build 為 `.mjs`（`pdf.min.mjs` 445K、`pdf.worker.min.mjs` 1.3M），`cmaps/` 1.5M、`standard_fonts/` 804K
- `jszip@3.10.1` **無 `exports` 欄位、只有 UMD**，故必須用 `<script>` 載入並讀 `window.JSZip`，不可 `import`
