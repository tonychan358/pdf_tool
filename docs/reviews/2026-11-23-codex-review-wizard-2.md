> 審查者：Codex CLI（gpt-6.1-sol，effort high）｜範圍：`git diff 398b3556..2ad0f542 -- 100_Todo/pdf-toolbox`｜brief：`docs/reviews/briefs/wizard-review-2.md`

發現 **0 Critical／2 Important／3 Minor**。`npm test` **88／88 通過**；未發現六頁 PDF 核心運算相對基線被改壞。全程未修改檔案、未 commit。

1. **Important｜接力讀取可繞過 running 鎖，造成清單與輸出不一致**  
   位置：[toolpage.mjs:219](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/core/toolpage.mjs:219)、[handoff.mjs:101](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/core/handoff.mjs:101)。  
   **問題：**等待 IndexedDB 時仍可手動選檔；接力返回後直接 `sync([file])`，沒有 running／世代檢查。自訂頁的 `applyFiles()` 接力入口亦有相同風險。  
   **重現：**延遲接力 A，手動加入 B 並開始處理，再放行 A。以實際 `mountTool` 配延遲 stub 重現：最終清單為 A，完成結果來自 B。  
   **建議：**接力初始化期間持有共用輸入鎖，於 `finally` 釋放；若容許手動替換，必須用世代檢查拒絕遲到接力。補延遲接力與處理中碰撞測試。

2. **Important｜圖片／N-up／留白的設定未納入處理鎖**  
   位置：[toolpage.mjs:122](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/core/toolpage.mjs:122)。  
   **問題：**鎖只涵蓋上載、清單及精靈按鈕，沒有停用方向、每版頁數、間距、留白位置及闊度。運算已捕捉舊設定，但畫面及摘要仍可改變。  
   **重現：**大型 PDF 以 2-up 開始處理，中途改為 4-up；摘要會更新，輸出仍按 2-up 產生。  
   **建議：**將第二步設定放入受鎖控制的 `fieldset`，成功及失敗均恢復原有 disabled 狀態。測試應實際嘗試修改設定，並核對輸出。

3. **Minor｜單檔清單手機版也強制把「✕」推到第二行**  
   位置：[design.css:1670](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/css/design.css:1670)、[design.css:1956](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/css/design.css:1956)。  
   **問題／重現：**手機規則令所有 `.row-actions` 佔滿一行；除了 organize，split、interleave、nup、margin 截圖亦有相同情況。  
   **建議：**另起操作列只套用可排序清單；單檔清單使用「序號／紙張／可縮檔名／44px 移除掣」同列排法，長檔名只在文字區換行。

4. **Minor｜拆分模式標題重複，而且會誤示目前模式**  
   位置：[split.html:28](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/tools/split.html:28)。  
   **問題／重現：**標題與第一個 radio 都使用 `split.modeCount`；切到自訂範圍後，上方仍寫「每 N 頁一份」。桌面及手機截圖均可見。  
   **建議：**改成 `fieldset`／`legend`「拆分方式」，新增對應英文 key。

5. **Minor｜瀏覽器驗證未守住實際頁面內容及順序**  
   位置：[verify-wizard.mjs:231](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/scripts/verify-wizard.mjs:231)、[verify-wizard.mjs:237](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/scripts/verify-wizard.mjs:237)。  
   **問題：**ZIP 只驗份數及頁數；其他工具主要驗檔名及頁數，無法證明分組、交錯順序、圖片排版或留白正確。  
   **重現：**以兩份都包含來源第 1–4 頁的 PDF 執行現有 ZIP 斷言，仍然通過，第 5–8 頁遺失未被偵測。  
   **建議：**使用每頁有唯一標記的 fixture，核對輸出頁面身份與順序；另補頁面尺寸／位置、名單及錯誤範圍、正反頁數不等、失敗解鎖，以及真正並發的單次接力測試。

本輪另檢視了設定及完成截圖；未重跑會寫入專案截圖的完整瀏覽器腳本。上述競態及測試缺口均以記憶體內測試驗證。

## 處理結果（LonelyClaude）

| 項目 | 核實 | 處理 |
|---|---|---|
| 1 接力讀取繞過鎖 | 屬實（讀 code：`sync([file])` 無鎖／世代檢查） | 共用 `createInputGuard()`，接力期間持鎖＋世代檢查；`tests/handoff-input.test.mjs` |
| 2 設定未納入處理鎖 | 屬實 | `mountWizardShell()` 鎖第二步所有控制並還原原 disabled 狀態；`tests/wizard-locks.test.mjs` |
| 3 手機「✕」跌落第二行 | 屬實（截圖） | 非 sortable 清單同列排法；375px 截圖逐張確認 |
| 4 拆分標題重複 | 屬實（截圖） | `fieldset`／`legend`「拆分方式」 |
| 5 驗證未核頁面身份 | 屬實 | 唯一標記 fixture，核對拆分／交錯／頁面編輯頁序；瀏覽器斷言 230 → 298 |

修正由 Codex exec 實作（報告：`docs/reports/2026-11-23-wiz2-fix-codex-report.md`），Claude 核實：`npm test` 99/99，截圖檢查。
