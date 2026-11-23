# 精靈第二批 review #2 修正報告

日期：2026-11-23。所有修改限目前專案副本，沒有 commit 或部署。

指定的 `docs/reviews/2026-11-23-codex-review-wizard-2.md` 不在此副本內；本次依使用者任務書及內容一致的 `FIX_BRIEF.md` 修正全部五項，並參照第二批實作報告、`DESIGN.md` 及進度記錄。

## 1. 接力讀取輸入鎖與世代防護

- `wizard-state.mjs` 新增共用 `createInputGuard()`：一般輸入在接力期間被拒絕，只有仍屬目前世代的持有者可以帶入接力檔案；手動選檔及工作啟動會令舊世代失效。
- `receiveHandoff()` 從 IndexedDB 讀取前取得鎖，直到目標頁非同步載入完成才釋放。`hold()` 的 `finally` 涵蓋成功、讀取失敗、載入失敗及提前返回；過時的成功、錯誤與載入提示均被忽略。
- `mountTool()` 的同步檔案入口、清單、選檔、返回及處理入口共用此鎖。拆分、交錯、頁面編輯的 `applyFiles()` 入口亦檢查鎖及持有者，保留既有載入／縮圖世代防護，再於非同步完成時核對接力世代。

## 2. 六頁設定鎖與原有 disabled 狀態

- `mountWizardShell()` 統一鎖定第二步的 input、select、textarea，涵蓋拆分、交錯、圖片方向、N-up 頁數／間距、留白位置／闊度；頁面編輯的縮圖按鈕使用相同的 `createControlLock()`。
- 鎖首次生效時保存每個控制原有的 disabled 值，反覆進度更新不覆寫快照。成功與失敗解鎖均恢復原值。拆分及交錯移除直接將設定欄位全部解鎖的舊路徑，預覽／處理按鈕仍按文件及預覽是否有效決定可用性。
- 頁面編輯切語言時原地更新按鈕 title、aria-label 及保留頁數，避免在工作期間重建按鈕而遺失 disabled 快照；接力載入需要的縮圖重畫仍會延後至解鎖。
- 沒有改動 PDF 排版、頁面複製、旋轉及留白計算；原有處理快照、數值限制與防護繼續保留。

## 3. 手機單檔清單

- 760px 以下僅對非 sortable 清單取消行內換行及操作區的整行寬度，文字區可收縮及換行，序號、紙張及移除按鈕保留寬度。
- 已逐張檢視 split、interleave、nup、margin、organize 的 375px 截圖；短檔名及長檔名的「✕」均與檔案內容並排，按鈕維持至少 44px，頁面無橫向溢出。可排序清單樣式不變。
- 更新截圖位於 `docs/verification/wiz2/`，另新增五張 `*-long-filename-mobile.png`。

## 4. 拆分模式語意與翻譯

- 模式選項改為 `fieldset`／`legend`，新增 `split.modeLegend`：繁中「拆分方式」、英文「Split method」。
- 「每 N 頁一份」只作相應 radio 的名稱，不再重複充當模式群組標題；維持既有三種模式行為。

## 5. 驗證腳本加強

- 以本地 pdf-lib 在腳本內生成八頁來源及正反面來源，每頁繪有獨立可讀標記，另以 PDF 頁面屬性保存身份，透過本機 server 供測試使用，不新增 CDN 或網絡依賴。
- 拆分 ZIP 逐份核對 `[P01…P04]`、`[P05…P08]`；交錯核對 `F1,B1,F2,B2,F3,B3`；頁面編輯亦核對完整頁序與旋轉。
- 六頁各測輸出 save 失敗、立即鎖定、恢復原有 disabled 狀態，再成功處理。處理期間嘗試點擊設定及強制更改 DOM 設定，核對輸出的頁序、頁數與版面維持啟動時的設定。
- 五個 PDF 目標頁延遲 IndexedDB 成功回呼，確認等待期間拒絕手動選檔及直接處理事件、完整載入後恢復輸入。另強制更新世代，驗證遲到接力及遲到錯誤不覆蓋新選擇或處理狀態。
- 保留原有合併、壓縮、ZIP、雙語、不同螢幕寬度、IndexedDB 單次使用／過期／大檔等回歸測試。

## 測試與結果

- TDD：先新增四條 Node 鎖測試並執行，全部因尚未實作共用鎖而失敗；實作後轉綠。再補七條接力生命週期整合測試，涵蓋非同步載入期間持鎖、遺失記錄、載入失敗、手動／工作世代取代、遲到錯誤、目標拒收。新增檔案為 `tests/wizard-locks.test.mjs` 及 `tests/handoff-input.test.mjs`。
- 語言切換加強回歸先重現頁面編輯失敗後遺失 disabled 狀態，再修正並通過。
- `npm.cmd test`（Windows 的 `npm test`）：**99 / 99 通過**。
- `node scripts/verify-wizard.mjs`：**298 項斷言通過，exit 0**；Console／瀏覽器例外 **0**、對外請求 **0**。機器可讀結果：`docs/verification/wiz2/browser-result.json`。
- 獨立唯讀審查及語言切換修正後的補審均無未處理發現。
- `git diff --check` 通過；改動文字檔已掃描連續四個問號及 Unicode 替代字元，沒有亂碼。

本次瀏覽器驗證使用本機 headless Chrome；未另行測試 Firefox／Safari。PDF 運算模組及 vendor 未修改。
