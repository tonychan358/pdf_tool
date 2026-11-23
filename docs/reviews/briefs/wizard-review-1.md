# Code Review brief：pdf-toolbox 逐步精靈改版 檢查點 #1（Task 1–4）

你是獨立的程式審查員。**只審查、不修改任何檔案、不 commit。** 工作目錄是 git repo 根 `D:/AI_AGENT/claude`。

## 審查範圍

```bash
git diff 0e98e3ab..150b5fe0 -- 100_Todo/pdf-toolbox
```

- `150b5fe0`：新設計系統（design.css、DESIGN.md）、共用頂欄（chrome.mjs）、首頁、精靈外殼（toolpage.mjs、dropzone.mjs、completion.mjs、wizard-state.mjs、filemeta.mjs、handoff.mjs stub）、合併頁。

工作樹內可能有其他 session 未 commit 的改動，不在本次範圍。

## 必讀

1. 計劃：`100_Todo/pdf-toolbox/docs/plans/2026-11-23-wizard-redesign.md`（第一節逐項表、Task 1–4）
2. 實作者報告：`100_Todo/pdf-toolbox/docs/reports/2026-11-23-wiz1-codex-report.md`
3. `100_Todo/pdf-toolbox/docs/progress.md` 尾段：現有防護（running 鎖、sync() 單一事實來源、動態文字隨語言更新、逐檔錯誤歸因）

## 審查重點

1. 精靈步驟狀態：加檔／移除／返回上載／返回調整／開始新的…之間，畫面、`ctrl.files`、dropzone 內部 state、完成結果有冇可能唔一致（例如返回調整後改次序，完成畫面仍然下載舊結果）。
2. 完成畫面壓縮：快速切換級別／開關、壓縮中返回或重新開始，會唔會用錯結果、雙重下載、或者掣永遠鎖住；壓縮較大／失敗嘅回退。
3. 向後兼容：其餘 6 個未改 HTML 嘅工具頁經 `mountTool` 仍然 run 完即下載；共用頂欄注入唔可以同佢哋原有 `#lang-toggle`／header 撞（重複 id、雙重綁定）。
4. 記憶體：大 PDF（例如 20 MB）頁數讀取、完成結果、壓縮結果有冇不必要嘅重複複本或未釋放嘅 object URL／pdf.js worker。
5. i18n：所有新文字 zh/en 齊；動態文字切語言即更新；`data-i18n-vars` 用 JSON.parse，有冇被檔名等用戶輸入弄爆（例如檔名含引號）。
6. 安全：檔名等用戶輸入有冇經 innerHTML 插入。
7. 測試是否真的釘住規則：有冇測試即使實作錯咗都會通過。

## 刻意決定（唔算問題）

- 接力只係 stub（Task 6 先做）。其餘 6 頁未套精靈（Task 5）。dialog／toast 不做。
- 檔案行用 CSS 紙張示意圖，唔渲染真縮圖。

可以執行：`cd 100_Todo/pdf-toolbox && npm test`。可以寫臨時測試重現問題，但只可放系統暫存目錄。

輸出：按嚴重程度（Critical／Important／Minor）列出，每點寫檔案:行、問題、重現方法、建議修正。
