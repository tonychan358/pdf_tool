# PDF 工具箱逐步精靈改版 — 第一批交接

日期：2026-11-23。範圍：計劃 Task 1–4，以及本批新增介面的中英文文字。所有變更均在目前 cwd；未 commit、未部署。

## 完成結果

首頁、全站共用頂欄／頁尾與合併精靈已完成。合併流程為上載 → 排序確認 → 下載；共用完成畫面支援改檔名、預先壓縮、原檔回退及多輸出 ZIP。其餘六個工具的 HTML 完全未改，繼續使用原有處理／交付流程，並套用新樣式及共用頂欄。

`pdf.mjs`、`paging.mjs`、`naming.mjs` 與 `thumbs.mjs` 均未修改。接力只有 UI 與 stub，未實作 IndexedDB。

## 修改／新增檔案

| 檔案 | 內容 |
|---|---|
| `assets/css/design.css` | 採用 mockup 的深綠、米白、黃、薄荷與珊瑚 token；加入頂欄、選單、工具卡、步驟、檔案行、摘要、完成頁、壓縮及接力元件；保留舊頁 class 相容樣式，含 760px／1000px 與 reduced-motion。修正 mockup 中少於 44px 的觸控目標。 |
| `DESIGN.md` | 依原有 Colors／Typography／Spacing／Radius／Components／Do's & Don'ts／Responsive 結構改寫。 |
| `assets/core/chrome.mjs` | 注入品牌、私隱徽章、七工具＋首頁選單、唯一的語言按鈕及頁尾；選單支援 Escape、鍵盤與目前頁面標記。 |
| `assets/core/i18n.mjs` | 初始化時注入 chrome 並避免重複綁定；支援 `data-i18n-vars` 動態參數及可重譯的巢狀錯誤原因。 |
| `index.html` | hero、黃色底線、沿用 mockup SVG 插畫、兩組七張工具連結卡、深綠私隱橫條。 |
| `assets/core/toolpage.mjs` | 由步驟條標記啟用精靈；保留 running／sync 防護、onResult 與舊頁即時 deliver；新增返回、重設、共用完成頁及壓縮期間的鎖定。 |
| `assets/core/dropzone.mjs` | 鍵盤上載；新版檔案行、序號、CSS 紙張、非同步頁數、44px ▲▼✕；保留 sortable 差異、拖曳 state、同步及防重複監聽；排序後恢復鍵盤焦點。 |
| `assets/core/filemeta.mjs` | 透過 pdf-lib 讀取頁數，只快取數字／Promise；無法讀取時回傳 null；摘要不把未知頁數誤算為零。 |
| `assets/core/wizard-state.mjs` | 可獨立測試的步驟轉換及下載 bytes 選擇規則。 |
| `assets/core/completion.mjs` | 共用結果卡、檔名編輯、預先壓縮、大小／減少百分比、黃色下載、接力卡及多輸出 ZIP 分支；世代檢查阻止過期壓縮結果覆蓋新選項。 |
| `assets/core/handoff.mjs` | `handoff(bytes, name, targetTool)` stub；接收原始結果，回報功能未提供，不導航或假裝已傳檔。 |
| `tools/merge.html` | 三步精靈、排序清單、頁數及大小摘要、底部動作列與共用完成頁；保留逐檔錯誤歸因及 yieldToUI。 |
| `assets/i18n/zh.json` | 全部新增介面的繁體中文文字。 |
| `assets/i18n/en.json` | 對應英文文字，key 與中文一致。 |
| `tests/filemeta.test.mjs` | 實際 PDF 頁數、空 MIME／副檔名、快取、讀取失敗、未知頁數摘要。 |
| `tests/wizard-state.test.mjs` | 空清單、步驟轉換、結果過期、重設、較小／相同／較大壓縮結果。 |
| `tests/syntax.test.mjs` | 保留共用模組檢查，另遍歷 HTML 檢查 doctype 及所有 inline scripts，包含 mockup。 |
| `scripts/verify-wizard.mjs` | 無第三方套件的本機 Chrome／CDP 回歸；測試七工具、排版、壓縮、錯誤、ZIP、語言、鎖與焦點，保存截圖及 JSON 結果。 |
| `README.md` | 更新測試數量、精靈第一批範圍、驗證指令、壓縮限制及設計說明。 |
| `docs/verification/wiz1/browser-result.json` | 104 項瀏覽器檢查結果；頁面對外請求與 Console error／例外均為空。 |
| `docs/verification/wiz1/home-desktop.png` | 首頁桌面截圖。 |
| `docs/verification/wiz1/home-mobile.png` | 首頁手機截圖。 |
| `docs/verification/wiz1/merge-sort-desktop.png` | 合併排序桌面截圖。 |
| `docs/verification/wiz1/merge-sort-mobile.png` | 合併排序手機截圖。 |
| `docs/verification/wiz1/merge-complete-desktop.png` | 完成頁桌面截圖，展示壓縮較大時回退原檔。 |
| `docs/verification/wiz1/merge-complete-mobile.png` | 完成頁手機截圖，展示可改檔名與原檔回退。 |
| `docs/verification/wiz1/merge-compressed-mobile.png` | 完成頁手機截圖，展示有效縮小、減少百分比及實際下載大小。 |
| `WIZ1_REPORT.md` | 本交接報告。 |

## 計劃第一節逐項驗收

| # | 本批狀態 |
|---|---|
| 1 配色 token／設計文件 | 完成。 |
| 2 共用品牌、私隱徽章、語言切換 | 全站完成。 |
| 3 工具下拉選單 | 全站完成，包含七工具及首頁。 |
| 4 首頁 hero／插畫 | 完成，手機隱藏插畫。 |
| 5 首頁分組卡／SVG／箭頭 | 完成。 |
| 6 深綠私隱橫條 | 完成。 |
| 7 三步步驟條 | 共用能力及合併頁完成；其餘六頁套用屬 Task 5。 |
| 8 一步一畫面／返回 | 共用能力及合併頁完成；返回上載保留清單，可再加檔。 |
| 9 新檔案行／頁數／排序 | 共用清單完成；七工具沿用清單時均取得新樣式，非 sortable 不顯示把手或排序掣。 |
| 10 合併摘要卡 | 完成，頁數載入中與無法讀取均有對應狀態。 |
| 11 底部動作列 | 合併頁完成，手機主掣全寬。 |
| 12 共用完成畫面 | 完成並套於合併；其他工具保留舊行為，待 Task 5。 |
| 13 可修改下載檔名 | 完成；預設跟隨語言，手動改名後保留輸入。 |
| 14 壓縮／三格／警告／實際大小 | 共用能力及合併頁完成；較大或失敗均保留可下載原檔。預設關閉壓縮。 |
| 15 接力 | 三張卡與 stub 完成；IndexedDB 與跨頁載入明確留待 Task 6。 |
| 16 開始新的合併 | 完成，清空並返回第一步。 |
| 17 頁尾 | 全站完成。 |
| 18 dialog／toast | 依計劃不做，使用 `.msg`。 |
| 19 mockup 審閱列／畫面標籤 | 依計劃不帶入產品。 |
| 20 手機排法 | 完成，本機 Chrome 多寬度驗證通過。 |

## 驗證證據

- `npm.cmd test`：85／85 通過，即原有 76 條＋9 條新增測試。PowerShell 的 `npm.ps1` 受執行政策限制，因此使用等效的 npm.cmd；未變更系統政策。
- `node scripts/verify-wizard.mjs`：104 項通過。首頁中英文及合併主要畫面檢查 320／375／760／1000／1440px；舊六頁中英文檢查 375／760／1000px，均無橫向溢出。
- 七工具實際執行處理與交付路徑；新精靈完成前不自動下載，舊頁維持即時交付。
- 拖曳與按鈕排序、鍵盤焦點、刪檔後再加檔不復活、返回上載保留清單、running 期間直接派發移除事件亦被拒絕、重新開始清空均通過。
- 三種壓縮級別、快速切換、壓縮較大、故意令 canvas 失敗後回退、下載大小及壓縮後 PDF 頁數均驗證。下載點擊在測試中攔截，以檢視實際 Blob 內容。
- 多輸出的共用完成畫面透過測試用精靈驗證：隱藏壓縮／接力，建立含兩個 PDF 的真實 ZIP。
- 動態頁數、摘要、壓縮資訊、自訂檔名、逐檔錯誤與巢狀原因皆驗證切換語言；頁面 Network 觀測零對外請求，Runtime 觀測零 Console error／未處理例外。
- 已檢視桌面／手機截圖，並對照指定 mockup HTML 與 full.jpg 的配色、布局、紙張、摘要及完成畫面。
- 獨立 Codex 唯讀 review 及最後新增項目的複查均未發現可重現問題；未因此改動六個舊工具的 HTML。
- 改動文字檔以嚴格 UTF-8 解碼，並搜尋四個連續問號與 U+FFFD，未發現編碼損壞；`git diff --check` 無空白錯誤。

## 未做與驗證界線

- Task 5：其餘六頁尚未改成三步精靈；這是本批要求的向後相容狀態。
- Task 6：接力不儲存 IndexedDB、不開啟目標頁、不自動載入；卡片會清楚提示先下載再到目標工具開啟。stub 已接收原始 bytes、編輯後檔名及目標工具。
- 尚未部署、未 commit。沒有執行跨工具 IndexedDB 串連，也未逐一覆蓋七工具所有選項的組合或在實體觸控裝置上操作。
- 自動化使用本機無頭 Chrome，不等同 Safari／Firefox 或實體螢幕閱讀器驗證；HTML 的自動檢查涵蓋 doctype 與腳本語法，並非完整 W3C validator。
- 保留 `.wiz1-check/` 作為測試暫存資料：最後清理此資料夾的 PowerShell 動作被自動核准審查拒絕，工具只提供「blocked by policy」，未提供更細原因。此資料夾不屬產品或交付原始碼，沒有寫入其他工作資料夾。
