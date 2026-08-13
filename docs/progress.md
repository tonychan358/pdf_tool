# PDF 工具箱 — 進度

## 現況

v1 完成：七個工具全部可用，本機 port 8010。純靜態、零後端、檔案不離開瀏覽器。2026-08-12 完成全站收尾（文件、無頭瀏覽器全站回歸、遺留項清理）；同日再完成最終全站 review 修正波（13 項發現，詳見下方日誌同 `docs/plans/2026-08-07-pdf-toolbox.md` 旁邊嘅 `.superpowers/sdd/2026-08-07-pdf-toolbox/final-fix-report.md`）。

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
- [x] README、全站回歸、收尾

## 未做（刻意排除，非遺漏）

- [ ] 公開部署到 GitHub Pages —— 需要 Lonely SIR 批准後才加 remote / push
- [ ] OCR、檔案壓縮、PDF 轉 Word —— 需要後端，與零後端定位衝突
- [ ] 小冊子 booklet 排版、統一頁面尺寸 —— v2 再評估
- [ ] CSV / Excel 名單上傳 —— 貼文字已足夠，加 SheetJS 不划算

## 日誌

- 2026-08-07 — 完成 brainstorming，寫定設計規格與實作計畫。
- 2026-08-07 至 2026-08-11 — Task 1-14：專案骨架、共用模組、七個工具逐一實作並各自 code review。過程中發現並修正三個影響輸出正確性的 bug（`buildNames` 去重邏輯、`marginEdge` 實作與測試互相矛盾、Task 6 的 i18n 載入失敗處理／設計 token／字型堆疊落地時同計畫文件產生落差），詳細記錄喺 `docs/plans/2026-08-07-pdf-toolbox.md` 嘅 Self-Review 記錄。
- 2026-08-12 — Task 15 收尾：
  - **修正三項遺留（Part A #1-3）**：
    1. `dropzone.mjs` 嘅檔案清單「移除」按鈕改用 `data-i18n` 屬性掛入共用 `apply()` 機制，語言切換後會同其餘介面一齊即時變返啱嘅語言（原本淨係喺清單重新 render 嗰刻先用 `t()` 填字一次，之後就同語言切換脫節）。順手發現同一類問題喺 `tools/interleave.html`（正面/背面頁數提示）同 `tools/split.html`（預覽表格）都存在，一併修正（各自加咗語言切換監聽器重畫）。
    2. `naming.mjs` 的 `sanitizeFileName` 加咗第二個可選參數 `fallback`（預設值仍為 `'未命名'`，保持模組本身唔識 `t()`、唔 import 任何嘢嘅純字串模組規矩，亦保持全部舊測試原封不動通過）。六個直接呼叫 `sanitizeFileName` 命名輸出檔嘅工具頁（merge / interleave / images-to-pdf / organize / nup / margin）已改為傳入 `t('common.untitled')`；`common.untitled` 已加入 `zh.json`（未命名）／`en.json`（Untitled）。
    3. `docs/plans/2026-08-07-pdf-toolbox.md` 的 Task 6 程式碼區塊（`i18n.mjs`、`design.css`）已更新為實際落地版本並加註記，計畫最尾 Self-Review 記錄新增第 5 點解釋三處分別（fetch 失敗處理、`-800` 對比色階、字型堆疊拎走 `Noto Sans TC`）同原因。
  - **記錄兩項唔修（Part A #4-5）**：`mountTool` 死碼預設 `zipName`、`paging.mjs` 未映射錯誤 code 嘅範圍與原因，寫入 `README.md`「已知限制」一節。
  - **`test-fixtures/images-to-pdf/`**：判斷為有用嘅測試素材（landscape 1200×700／portrait 600×900／phone-portrait 3000×4000，剛好對應圖片轉 PDF 工具嘅「自動判斷／直向／橫向」三種方向邏輯），已 commit 保留，非殘留垃圾。
  - **全站回歸**：起本地 server，用 headless Chrome（Chrome DevTools Protocol，無外部套件、原生 WebSocket）逐頁自動驅動：七張卡連結全通、七頁「返回工具箱」都返到 hub、語言切換喺任一頁生效並跨導覽／重新整理保持、每頁隱私聲明存在、DevTools Network 全程零對外請求（含 pdf.js worker／cmaps 都係同源載入）、Console 全程零 error。七個工具都用 `test-fixtures/` 真實樣本檔跑咗一次端對端（上傳 → 執行 → 落地），輸出檔／ZIP 內容都用 `unzip -l`／magic bytes 核對過。另外針對三項修正各寫一次即時語言切換的專項驗證（同一個已渲染畫面、唔重新整理、直接切語言），確認「移除」按鈕、交錯合併頁數提示、拆分預覽表格都會即時跟住變、輸出檔名喺英文介面下變成 `Untitled.pdf` 而唔係 `未命名.pdf`。
  - 自動化測試由 70 條加到 73 條（新增 `sanitizeFileName` fallback 參數的三條測試），`npm test` 全綠。
  - `README.md`、`docs/progress.md` 已寫；`200_Obsidian/202_Project/pdf-toolbox/` junction 已確認生效（見得到 `progress.md`／`plans/`／`specs/`）。
- 2026-08-12（同日再一輪）— 最終全站 review 修正波，5 項重大 + 8 項次要，逐一修正：
  1. **`toolpage.mjs`／`zip.mjs`（假成功）**：`mountTool` 加 `running` 鎖——跑緊 job 期間 `dz.setEnabled(false)` 鎖住 dropzone（拖放／選檔／keyboard 全擋，CSS `.dropzone.disabled` 做視覺提示），清單「移除」按鈕嘅改動路徑（`onListChange`）同一時間都會被吞，`ctrl.files` 喺成個 job 期間保證唔變。`zip.mjs` 嘅 `deliver([])` 由靜默 no-op 改做拋 `AppError('error.noOutput')`（現時全部呼叫方都唔會踩到，但守住呢個不變量）。
  2. **`split.html`（下載迴圈跨 yield 讀 mutable state）**：download click handler 一開波就將 `plan`／`doc`／檔名鎖做 local snapshot，成個迴圈淨係讀呢幾個 local；同時鎖住「產生預覽」掣同全部選項欄位（mode radio／everyN／ranges／roster／pattern），download 完成／出錯都會喺 `finally` 解鎖。
  3. **`dropzone.mjs`（skip 警告錯誤歸因）**：`take()` 將「類型唔啱」（`type`）同「單檔模式超出上限」（`limit`）分開計，`onChange` 簽名由 `skippedCount:number` 改做 `{type, limit, keptName}`；超出上限嗰種新增 `warn.onlyFirstUsed`（帶 `{name}`，話俾用戶知邊個檔案真係被留低），5 個呼叫方（`toolpage.mjs`／`split.html`／`interleave.html`／`organize.html`）全部同步更新。
  4. **`interleave.html`（正反不等頁靜默處理）**：`updateCounts()` 一見到 `docs.front`／`docs.back` 都揀咗但頁數唔一致，就用 `.msg.warn` 貼一句新 key `interleave.unequalStacks`（暗示可能漏咗一頁掃描，但唔阻擋處理）；頁數之後夾返啱會用 `msgEl.dataset.kind` 標記自動撤走呢句警告，唔會誤撤其他嚟源嘅訊息。
  5. **`images-to-pdf.html`（冇逐檔錯誤歸因）**：跟 `merge.html` 嘅 `error.mergeFileFailed` 樣式，加平行嘅新 key `error.imageFileFailed`（`{name, reason}`），`embedImage()` 失敗時話俾用戶知邊張相出事。
  6. **`README.md`**：測試數由 70 改做實際 `npm test` 輸出（呢輪加咗 2 條新測試後最終係 **75** 條，唔係任務描述提到嘅 73——已對住 `npm test` 實際輸出核實）。
  7. **`zh.json` 加密 PDF 訊息**：「請先解鎖後再上傳」改做「請先在其他工具解鎖，再重新拖入此頁」，唔再暗示會上傳（同上面隱私聲明矛盾）；`images.heicHint` 新字串一齊順手檢查過冇用「上傳」呢隻字。
  8. **`smoke.test.mjs`**：加一條斷言 `vendor/pdfjs/cmaps/` 存在且非空（缺咗會令縮圖中文字符靜默變空白格）。
  9. **`organize.html`**：`run` 掣預設 `disabled`，`applyFiles()` 每輪讀取／縮圖渲染期間持續停用，直至 `renderThumbs` 完成、`srcDoc` 真正賦值先解鎖——避免「畫面已見到檔案清單同即時進度數字，撳掣卻話請先選擇檔案」呢個自相矛盾嘅視窗。
  10. **`paging.mjs` `parseRanges`**：全形／排版連接號 `－`（U+FF0D）、`–`（en dash）、`—`（em dash）同全形逗號一齊正規化做半形 `-`／`,`；`paging.mjs` 保持零 import／DOM-free，舊測試原封不動，新增一條測試覆蓋呢個正規化。
  11. **`README.md`**：加一段講明必須經 `http://` 開啟（BAT 或自架 server），雙擊 `index.html` 用 `file://` 開會係一個空白介面（module script 讀唔到，連錯誤橫幅都唔會出現）。
  12. **`images.hint`**：加新 key `images.heicHint`（zh／en 都有），教 iPhone 使用者將相機格式改做「最相容」或者先匯出做 JPG——HEIC 依家會被 `embedImage()` 拒收，冇呢句提示嘅話老師會撞極都唔知點解。
  13. **`design.css` grab 游標**：`.filelist li` 嘅 `cursor: grab` 移到新規則 `.filelist.sortable li`，`dropzone.mjs` 嘅 `renderFileList()` 同步喺 `ul` 度切換 `sortable` class；split／organize／nup／margin 用嘅單檔／唔支援排序清單唔再暗示拖得郁，merge／images-to-pdf 保持原有 grab 游標。
  - **驗證**：`npm test` 全綠、73→**75**（新增 cmaps 存在性 1 條、`parseRanges` 全形連接號 1 條）。另外用無頭 Chrome（原生 CDP WebSocket，同 T15 全站回歸同一手法）逐頁重新核對：8 頁（hub + 七個工具）Console 零 error、Network 零對外請求；再針對 6 個口頭驗證項逐條寫合成 `File`／`change` 事件腳本實測，全部 PASS（詳見 `.superpowers/sdd/2026-08-07-pdf-toolbox/final-fix-report.md`）。
