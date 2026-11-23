> 審查者：Codex CLI（gpt-6.1-sol，effort high，review 模式）；範圍：`git diff 0e98e3ab..150b5fe0 -- 100_Todo/pdf-toolbox`

發現 **1 項 Important、2 項 Minor**；未發現 Critical。

1. **Important：快速切換壓縮會累積並行工作，重設亦不會取消。**  
   位置：[completion.mjs:111](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/core/completion.mjs:111)  
   世代檢查只阻止舊結果寫回，已開始的 `compressPdf()` 仍會完整執行，各自持有原始 bytes、PDF worker、canvas 及輸出文件。關閉壓縮會立即解鎖，容許返回或重新開始，但舊工作仍在背景執行。
   
   **重現：**合併大型多頁 PDF，開啟壓縮後快速切換級別，再關閉並重新開始。延遲 stub 實測同時存在三個工作，重設後仍全部持有原始 bytes；反覆操作可繼續累積，造成記憶體壓力及介面卡頓。  
   **建議：**加入可取消的壓縮工作，取消時銷毀 loading task；或將工作串行化，只執行最後選擇。

2. **Minor：確定不會採用的較大壓縮結果仍長期佔用快取。**  
   位置：[completion.mjs:117](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/assets/core/completion.mjs:117)  
   每個級別的結果均先存入 `cache`，之後才判斷是否比原檔小。即使下載已回退原檔，或已關閉壓縮，較大結果仍保留至下次重設。
   
   **重現：**依次完成三種級別，全部結果均大於原檔，再關閉壓縮。以 20 MiB 原檔及 21／22／23 MiB stub 結果測試，快取仍持有額外 66 MiB。  
   **建議：**較大結果只快取大小及「不採用」標記，釋放 bytes；可用結果亦應限制快取容量。

3. **Minor：快速切換測試未驗證下載結果屬於最後選擇的級別。**  
   位置：[verify-wizard.mjs:142](/D:/AI_AGENT/Claude/100_Todo/pdf-toolbox/scripts/verify-wizard.mjs:142)  
   目前只斷言 light radio 已選中、縮小提示可見、訊息隱藏，以及下載頁數／顯示大小一致。這些斷言無法區分「所有級別都錯用 standard」的實作，也未強制舊工作在最新工作之後完成。
   
   **重現：**在系統暫存副本中將所有級別固定使用 standard；只要仍能縮小，這組斷言便無法偵測錯誤。  
   **建議：**用可控制完成次序的壓縮 stub，讓各級別回傳可識別 bytes，核對最後下載內容；真實 PDF 測試另核對內嵌圖片像素尺寸。

`npm test` **85／85 通過**。上述資源問題以實際完成頁邏輯配合記憶體內 stub 重現；未重跑瀏覽器端對端，未修改任何檔案或 commit。
## 處理結果（LonelyClaude）

| 項目 | 核實 | 處理 |
|---|---|---|
| 1 Important：快速切換壓縮累積並行工作，重設唔取消 | 屬實（讀 `completion.mjs`：generation 只擋寫回，`compressPdf()` 照跑到尾） | `compressPdf()` 加 `signal`，每頁前 `throwIfAborted()`，finally 照 destroy worker；`completion.mjs` 每次重新準備、關閉、`reset()` 都 `abort()` 舊工作 |
| 2 Minor：較大結果長期佔快取 | 屬實 | 較大結果只快取 `{ tooBig: size }`，唔留 bytes；警告訊息照顯示大小 |
| 3 Minor：快速切換測試分唔出用錯級別 | 屬實 | 改用瀏覽器實測代替改 `verify-wizard.mjs`：同一份 18.6 MB×2 檔，「只揀標準」同「強力→輕度→標準快速切換」下載大小完全相同（282,487 bytes），「只揀輕度」為 1,666,849 bytes，證明下載嘅係最後揀嗰級；零 page error |

`npm test` 85／85 通過。
