# Code Review brief：pdf-toolbox 逐步精靈改版 檢查點 #2（Task 5–7）

你是獨立的程式審查員。**只審查、不修改任何檔案、不 commit。** 工作目錄是 git repo 根 `D:/AI_AGENT/claude`。

## 審查範圍

```bash
git diff 398b3556..2ad0f542 -- 100_Todo/pdf-toolbox
```

- `2ad0f542`：其餘 6 個工具頁（split／interleave／images-to-pdf／organize／nup／margin）套用三步精靈；`toolpage.mjs` 抽出 `mountWizardShell()`、刪除舊即時 deliver 路徑；`handoff.mjs` 以 IndexedDB 實作接力；`tool-summary.mjs`；`completion.mjs` 接力卡篩選；i18n；`scripts/verify-wizard.mjs`。

工作樹內可能有其他 session 未 commit 的改動，不在本次範圍。

## 必讀

1. 計劃：`100_Todo/pdf-toolbox/docs/plans/2026-11-23-wizard-redesign.md`（第一節逐項表、Task 5–7）
2. 實作者報告：`100_Todo/pdf-toolbox/docs/reports/2026-11-23-wiz2-codex-report.md`
3. 上一輪審查及處理：`100_Todo/pdf-toolbox/docs/reviews/2026-11-23-codex-review-wizard-1.md`
4. `100_Todo/pdf-toolbox/docs/progress.md` 尾段：現有防護（running 鎖、sync() 單一事實來源、動態文字隨語言更新、逐檔錯誤歸因）

## 審查重點

1. **PDF 運算有冇被改壞**：各頁 `run` 嘅頁面複製、旋轉、拼版、留白、圖片排版、拆分分組／命名，同 `398b3556` 版本比較行為有冇改變（包括邊界：空名單、名單多過份數、自訂範圍錯誤輸入、交錯正反頁數唔等）。
2. **步驟狀態一致性**：用自訂載入嘅頁（split、organize、interleave 等用 `mountWizardShell` 而非 `mountTool`）喺加檔／移除／返回／重新開始／處理中途，畫面、內部檔案、預覽、完成結果會唔會唔一致（例如返回調整改咗設定，完成畫面仍下載舊結果；預覽過時仍可拆分）。
3. **接力**：IndexedDB 讀寫、單次使用、過期、目標檢查、錯誤訊息；接力檔進入目標頁有冇行正常 sync 路徑（頁數、摘要、鎖）；`location.assign` 前寫入完成；URL 參數清走後重新整理唔會重載；多分頁同時開。
4. **鎖**：處理中、壓縮中、接力寫入中，所有可改變輸入或觸發第二次輸出嘅控制都要鎖住，完成後要解鎖（包括失敗路徑）。
5. i18n：新 key zh/en 齊；動態摘要切語言即時更新；檔名等用戶輸入冇經 innerHTML 插入。
6. 已知外觀問題，請一併建議修正：頁面編輯手機版檔案行嘅「✕」跌落第二行（見 `docs/verification/wiz2/organize-settings-mobile.png`）；拆分頁「每 N 頁一份」標籤同 radio 選項文字重複（見 `split-settings-desktop.png`）。順帶檢查其他截圖有冇類似問題。
7. 測試是否真的釘住規則。

## 刻意決定（唔算問題）

- dialog／toast 不做；檔案行用 CSS 紙張示意圖；圖片轉 PDF 唔做接力目標；拆分多輸出冇壓縮／接力。

可以執行：`cd 100_Todo/pdf-toolbox && npm test`。可以寫臨時測試重現問題，但只可放系統暫存目錄。

輸出：按嚴重程度（Critical／Important／Minor）列出，每點寫檔案:行、問題、重現方法、建議修正。
