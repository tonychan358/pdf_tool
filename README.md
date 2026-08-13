# PDF 工具箱

本地 PDF 處理工具，專為教師而設。所有處理在瀏覽器內完成，檔案不會上傳到任何伺服器。

## 啟動

雙擊 `啟動PDF工具箱.bat`，瀏覽器會自動開啟 `http://localhost:8010/`。
用完雙擊 `關閉PDF工具箱.bat`。

**Port：8010**（8000 已由 DSE-PP-Database 使用）。

**必須經 `http://` 開啟**（用 BAT，或者自己起一個 static server）。直接雙擊
`index.html` 用 `file://` 開會得一個空白介面——瀏覽器唔准 `file://` 頁面用
`<script type="module">` 讀取本機另一個檔案，連 `<script>` 本身都唔會執行，
所以連「無法載入介面文字」嗰句錯誤橫幅都唔會出現，畫面淨係得返一個冇任何
JS 生效嘅空殼。

## 七個工具

| 工具 | 用途 |
| :--- | :--- |
| 拆分 | 一疊掃描功課，每 N 頁（或自訂範圍／逐頁）自動拆成一份，並依班別名單命名 |
| 合併 | 把多份 PDF 依指定次序併成一份 |
| 交錯合併 | 單面掃描器分開掃正反面後，咬合成正確頁序 |
| 圖片轉 PDF | 把多張相片或截圖合成一份 A4 PDF |
| 頁面編輯 | 以縮圖檢視全部頁面，旋轉、刪除、重新排序 |
| N-up 拼版 | 把 2 或 4 頁併成一版 A4，列印時節省紙張 |
| 批改留白 | 每頁加上空白邊，方便手寫評語 |

## 技術

純靜態網站，無後端、無 build step。依賴 `pdf-lib`、`pdf.js`、`JSZip`，三者皆以實體檔案存放於 `vendor/`，不使用 CDN。介面文字全部經 `assets/i18n/{zh,en}.json` 兩份對照字典驅動，右上角一鍵切換繁體中文／English，選擇會存入 `localStorage` 並跨頁面、跨重新整理保持。

## 測試

```bash
npm test        # 即 node --test，不可帶路徑參數（Node 24 會 MODULE_NOT_FOUND）
```

自動化測試（75 條）只覆蓋純計算模組（分頁分組、範圍解析、檔名處理、交錯合併順序、N-up 版面與旋轉邊映射、i18n 字典一致性）。PDF 實際輸出以 `test-fixtures/` 內的樣本檔手動驗證，並於 2026-08-12 全站回歸中以無頭瀏覽器（Chrome DevTools Protocol）逐頁自動核對：七個工具端對端跑過一次、DevTools Network 分頁確認零對外請求、Console 零錯誤、語言切換跨頁面／重新整理持續生效。

## 已知限制

- **`mountTool` 的預設 `zipName: 'pdf-toolbox.zip'`（`assets/core/toolpage.mjs`）係寫死英文字串，未經 i18n。**目前所有工具都只會回傳單一輸出檔（`deliver()` 只在多輸出時先會讀 `zipName` 去命名 ZIP），所以呢個預設值實際上永遠去唔到——現時屬於死碼。日後如果加一個會輸出多個檔案的新工具（例如「逐頁另存」），記得幫個新工具自己傳一個經 `t()` 翻譯好嘅 `zipName`，唔好直接靠呢個預設值。
- **`paging.mjs` 部分錯誤 code 未有對應的 i18n key 映射。**`paging.mjs` 拋出嘅 Error 全部帶機讀 `code`（見該檔頂部註解），但只有 `tools/split.html` 的 `rangeErrorMsg()` 把 `RANGES_EMPTY`／`RANGE_UNPARSEABLE`／`RANGE_OUT_OF_BOUNDS`／`RANGE_REVERSED`／`EVERY_N_INVALID` 映射去對應 i18n key——因為呢幾個係由自由輸入（頁碼範圍文字、每份頁數）觸發，使用者真係打得出嚟。其餘 code（`TOTAL_PAGES_INVALID`、`INTERLEAVE_COUNT_INVALID`、`NUP_PER_INVALID`、`PAGE_SIZE_INVALID`、`GUTTER_TOO_LARGE`、`EDGE_UNKNOWN`、`FIT_SIZE_INVALID`）冇對應映射，萬一觸發會經 `error.generic` 顯示 `paging.mjs` 寫死嘅中文 `message`（英文介面下都會係中文）。呢啲 code 目前全部由固定嘅 radio 值（例如 `nup.html` 嘅 `per` 只有 `2`／`4`）或者已夾好上下限嘅數字輸入（例如 `nup.html` 的 gutter、`margin.html` 的留白闊度都喺 `change` 事件即時夾範圍）擋住，UI 層面行唔到呢啲分支。日後如果拆走呢啲防護（例如開放自訂 per 值），記得同步幫新拋得出嚟嘅 code 加映射。

## 尚未支援

OCR、檔案壓縮、PDF 轉 Word、加密解密、浮水印、頁碼頁眉、小冊子排版。前三者需要後端或重量級 wasm，與「零後端」定位衝突；其餘為 v1 刻意排除，非遺漏。

## 設計

視覺依專案根目錄 `DESIGN.md`（edu-light）。修改 UI 前請先閱讀。

## 規格與計畫

- 設計規格：`docs/specs/2026-08-07-pdf-toolbox-design.md`
- 實作計畫：`docs/plans/2026-08-07-pdf-toolbox.md`
