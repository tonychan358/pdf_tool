# PDF 工具箱 — 設計規格

> 日期：2026-08-07
> 專案：`100_Todo/pdf-toolbox/`
> 狀態：設計已確認，待轉實作計畫

---

## 1. 背景與目標

Lonely SIR 早前寫過一個獨立小工具：把一份 PDF 每 N 頁切成一個檔，解決「一疊多頁功課掃描成一份 PDF 後要逐份拆開」的痛點。本專案把該工具擴充成一個完整的本地 PDF 工具箱。

**目標使用者**：Lonely SIR 本人，以及其他香港中小學教師（最終會免費公開 host）。

**核心約束**：

- **零後端**。所有處理在使用者瀏覽器內完成，PDF 檔案不會離開使用者電腦。學生功課含個人資料，這是首要考量，也是對外公開時的信任賣點。
- **零 build step**。純靜態檔案，push 到 GitHub Pages 即可上線，不需 CI。
- **不做 OCR、不做真壓縮、不用 Python**。兩者都需要後端或重量級 wasm，與上述兩點衝突，明確排除在本專案範圍外。

---

## 2. 架構

**純靜態多頁網站**：一個 hub 入口頁，每個工具一個獨立 HTML 頁。

```
pdf-toolbox/
├── index.html                  ← 入口 hub，卡片列出所有工具
├── tools/
│   ├── split.html              ← 拆分
│   ├── merge.html              ← 合併
│   ├── interleave.html         ← 交錯合併
│   ├── images-to-pdf.html      ← 圖片轉 PDF
│   ├── organize.html           ← 頁面編輯
│   ├── nup.html                ← N-up 拼版
│   └── margin.html             ← 批改留白
├── assets/
│   ├── css/design.css          ← edu-light tokens
│   ├── core/
│   │   ├── pdf.mjs             ← 封裝 pdf-lib：載入、抽頁、砌新檔
│   │   ├── naming.mjs          ← 檔名 sanitize、名單對齊、{n} pattern
│   │   ├── paging.mjs          ← 分頁分組、交錯順序、N-up 版面計算
│   │   ├── zip.mjs             ← JSZip 打包下載
│   │   ├── dropzone.mjs        ← 拖放收檔、多檔拖曳排序
│   │   ├── thumbs.mjs          ← pdf.js 頁面縮圖（只有 organize 用）
│   │   └── i18n.mjs            ← 中英切換
│   └── i18n/
│       ├── zh.json
│       └── en.json
├── vendor/                     ← pdf-lib / pdf.js / jszip 本地一份
├── tests/                      ← node:test 單元測試
├── test-fixtures/              ← smoke test 用的 sample PDF
├── DESIGN.md                   ← edu-light 複本
├── README.md
├── .gitattributes              ← *.bat text eol=crlf
├── 啟動PDF工具箱.bat            ← port 8010
└── 關閉PDF工具箱.bat
```

### 2.1 為何多頁而非 SPA

- 老師若只用拆分，可直接 bookmark `tools/split.html`，不必每次經 hub 進入。
- 每頁檔案細、責任單一，新增工具不會影響既有工具。
- 無 router、無 framework、無 build，GitHub Pages 直接部署。

### 2.2 為何 vendor 本地而非 CDN

離線可用（學校網路不穩）、CDN 失效不影響全站、無第三方追蹤 —— 與「檔案不上傳」的定位一致。

**依賴**（全部 vendored）：

| 套件 | 用途 | 載入範圍 |
| :--- | :--- | :--- |
| `pdf-lib` | 所有 PDF 讀寫操作 | 全部工具 |
| `pdf.js` | 頁面縮圖渲染 | 只有 `organize.html` |
| `jszip` | 多檔打包下載 | 只有 `split.html`（v1 唯一多檔輸出的工具） |

拆分工具的預覽是「頁碼範圍 → 檔名」文字對照表，不需縮圖，故不載入 pdf.js。

### 2.3 模組邊界

| 模組 | 職責 | 依賴 |
| :--- | :--- | :--- |
| `paging.mjs` | 純計算：分組、順序、版面座標。**不碰 PDF、不碰 DOM** | 無 |
| `naming.mjs` | 純字串：sanitize、名單對齊、pattern 展開。**不碰 PDF、不碰 DOM** | 無 |
| `pdf.mjs` | PDF 讀寫。輸入輸出皆為 bytes 與純資料 | pdf-lib |
| `zip.mjs` | `[{name, bytes}]` → 觸發下載 | JSZip |
| `dropzone.mjs` | DOM 互動：拖放收檔、多檔拖曳排序 | 無 |
| `thumbs.mjs` | 用 pdf.js 把頁面渲染成 canvas 縮圖 | pdf.js（只被 `organize.html` 載入） |
| `i18n.mjs` | 掃 `data-i18n` 填字、切換語言、存 localStorage | 無 |

`paging.mjs` 與 `naming.mjs` 刻意設計成無依賴純函數，因為這兩者是最易出錯、也最值得自動化測試的部分（見 §6）。

### 2.4 雙語

HTML 文字用 `data-i18n="split.title"` 標記，`i18n.mjs` 開頁時掃一次填入，語言偏好存 `localStorage`。右上角一個切換掣。新增工具只需在 `zh.json` / `en.json` 各加一組 key。

專有名詞在中文版附英文（例：「交錯合併 Interleave」）。

---

## 3. 工具清單（v1）

| # | 工具 | 功能 |
| :-- | :--- | :--- |
| 1 | **拆分** | 每 N 頁一份 / 自訂頁碼範圍 / 逐頁拆單張；支援名單命名、pattern 命名、輸出前預覽 |
| 2 | **合併** | 多份 PDF 拖曳排序後併成一份 |
| 3 | **交錯合併** | 正面一疊 + 反面一疊，咬合成正確頁序；反面可選倒序 |
| 4 | **圖片轉 PDF** | 多張 JPG/PNG 排序後合成一份 A4 PDF |
| 5 | **頁面編輯** | 縮圖 grid：旋轉、刪頁、拖曳重排，輸出一份 |
| 6 | **N-up 拼版** | 2 或 4 頁併成 1 版 A4 |
| 7 | **批改留白** | 每頁加右邊或下邊白邊，供手寫評語 |

**明確排除於 v1**：小冊子 booklet 排版（釘裝規則多變、易出錯）、統一頁面尺寸（用途窄）。兩者留待 v2 再評估。

### 3.1 拆分工具的完整流程

```
1. 拖入 PDF          → 顯示「共 84 頁」
2. 選切法            → ⦿ 每 4 頁一份  ○ 自訂範圍  ○ 逐頁
3. 命名              → [貼名單] textarea（每行一個）
                       或 [模式] S5A_功課1_{n}.pdf
4. 按「產生預覽」→ 對照表：
   ┌────────────────────────────────────────────┐
   │ p.1-4    →  5A_01_陳大文.pdf                │
   │ p.5-8    →  5A_02_李小明.pdf                │
   │ ...                                        │
   │ p.81-84  →  未命名_21.pdf   ⚠ 名單只有 20 個 │
   └────────────────────────────────────────────┘
5. 確認無誤 → 按「下載 ZIP」
```

**命名規則細節**：

- 名單每行一項，自動 trim、自動略過空行。
- 名單項數少於拆出份數時，多出的用 pattern fallback（`未命名_{n}`），預覽表標紅但**不阻止下載**。
- 名單項數多於拆出份數時，多餘的忽略，預覽表標黃提示。
- 未提供名單時全部用 pattern，`{n}` 依總份數自動補零（21 份 → `01`…`21`）。
- 檔名非法字元 `\ / : * ? " < > |` 靜默替換為 `_`，預覽表顯示替換後的名。

---

## 4. 資料流

```
File (拖入)
  → ArrayBuffer
  → PDFDocument (pdf-lib)        ← 只存在於瀏覽器 JS heap
  → copyPages() 組成新 PDFDocument
  → Uint8Array
  → JSZip 打包（拆分工具）
  → Blob → <a download> 觸發下載
```

無 `fetch`、無 `XMLHttpRequest`、無任何對外請求。

每頁頂部常駐聲明（雙語）：**「所有處理在你電腦的瀏覽器內完成，檔案不會上傳到任何伺服器。」**

**輸出方式**：一律下載 ZIP（拆分等多檔輸出）或單一 PDF（合併等單檔輸出）。不使用 File System Access API，以保證所有瀏覽器行為一致。

**大檔處理**：不開 Web Worker。每處理完一份後 `await new Promise(r => setTimeout(r, 0))` 讓出主執行緒，配一條進度條（「處理中 12 / 21」）。100 頁以內的實際用例足夠。

---

## 5. 錯誤處理

原則：**能繼續的不阻擋，會產生錯誤輸出的一定要停。**

| 情況 | 處理 |
| :--- | :--- |
| PDF 有密碼保護 | pdf-lib 載入失敗 → 顯示「此 PDF 有密碼保護，請先解鎖後再上傳」 |
| 總頁數不整除（33 頁每 4 頁） | 照拆，預覽表最後一行標 ⚠「這份只有 1 頁」 |
| 名單項數 ≠ 拆出份數 | 預覽表標紅／黃，下載掣仍可按，多出者用 pattern fallback |
| 名單有空行或前後空格 | 自動 trim 並略過空行 |
| 拖入非 PDF 檔（.docx 等） | 即時擋下，「請拖入 PDF 檔」 |
| 圖片工具拖入非圖片 | 即時擋下，「請拖入 JPG 或 PNG」 |
| 檔案損壞 / 記憶體不足 | try/catch 包住，顯示可理解的訊息 + 建議改用較小的檔 |

所有錯誤訊息走 i18n，中英兩版都要有。禁止只丟 console error 而畫面無反應。

---

## 6. 測試策略

### 6.1 自動化單元測試（Node 內建 `node:test`）

`assets/core/paging.mjs` 與 `naming.mjs` 為純函數、無 DOM 無 PDF 依賴，可離開瀏覽器直接測。測試檔置於 `tests/*.test.mjs`。

必須覆蓋：

- **分組計算**：84 頁每 4 頁 → 21 組；33 頁每 4 頁 → 9 組且最後一組 1 頁；自訂範圍解析（`1-3,4-8,9-12`）含重疊與越界。
- **交錯順序**：正面 `[1,3,5]` + 反面倒序 `[6,4,2]` → `[1,2,3,4,5,6]`；兩疊頁數不等時的處理。
- **檔名**：非法字元替換、空行略過、trim、`{n}` 補零位數。
- **名單對齊**：名單多於／少於／等於份數三種情況的輸出。
- **N-up 版面**：2-up 與 4-up 的座標與縮放係數。

執行方式（見 memory `pitfall_node_test_dir_arg`）：

```bash
cd 100_Todo/pdf-toolbox
node --test          # ✅ 不帶參數，靠自動探索
# node --test tests/ ← ❌ Node 24 會 MODULE_NOT_FOUND
```

### 6.2 手動 smoke test

`test-fixtures/` 放一份 8 頁 sample PDF 與數張 sample 圖片。七個工具各跑一次，確認輸出檔可正常開啟且頁序正確。

不自動化驗證 PDF 二進位內容 —— headless 驗證成本遠高於收益。

---

## 7. 視覺設計

風格採用 `design-library` 的 **edu-light**（Mood：活潑、友善、清晰；參考 Khan Academy / Google Classroom）。開發前把 `100_Todo/design-library/themes/edu-light/DESIGN.md` 複製到專案根目錄，所有 UI 決定以該檔為準。

關鍵 tokens：primary `#6366f1`（indigo）、bg-base `#fafafa`、success `#10b981`、warning `#f59e0b`、error `#ef4444`、字體 Inter / system-ui。

hub 入口頁用卡片列出七個工具，每張卡片一句話說明用途（例：「一疊掃描功課，每 4 頁自動拆成一份並依名單命名」），對象是未必熟電腦的老師，說明要具體不要抽象。

---

## 8. 執行與部署

### 8.1 文件位置

依 memory `feedback_docs_in_100todo_junction`，doc 唯一真身放 `100_Todo/pdf-toolbox/docs/`，再用 Windows junction 接到 `200_Obsidian/202_Project/pdf-toolbox`。progress.md 於實作開始時建立。

### 8.2 本機

依 `CLAUDE.md` 的 local server 慣例，提供兩個 BAT，**port 8010**（8000 已被 `DSE-PP-Database` 佔用）：

- `啟動PDF工具箱.bat` — `cd` 入專案目錄 → 起 http server → 自動開瀏覽器到 `http://localhost:8010/`
- `關閉PDF工具箱.bat` — `netstat -ano | findstr :8010` → `taskkill /F /PID`

兩個 BAT 一律 CRLF，並加 `.gitattributes`（`*.bat text eol=crlf`），見 memory `pitfall_bat_needs_crlf`。

需要本機 server 而非直接開 `file://`，因為 ES module 與 `fetch('i18n/zh.json')` 在 `file://` 下會被 CORS 擋。

### 8.3 公開 host

零 build、零後端，GitHub Pages push 即上線。**但新增 remote 與 push 屬對外動作，須先取得 Lonely SIR 批准**（見 `CLAUDE.md` §Git）。v1 先完成本機版，實際用順手後再處理公開部署。

---

## 9. 範圍界線

**做**：§3 的七個工具、雙語介面、edu-light 視覺、本機 BAT、純函數單元測試。

**不做**（v1）：OCR、檔案壓縮、PDF 轉 Word、加密解密、浮水印、頁碼頁眉、booklet 排版、統一頁面尺寸、CSV/Excel 名單上傳、File System Access API 直寫資料夾、Web Worker、公開部署。

以上排除項目均為刻意決定，非遺漏。日後如需加入，各自另開一輪設計。
