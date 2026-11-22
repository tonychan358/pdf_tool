import { initI18n, t } from './i18n.mjs';
import { createDropzone, renderFileList } from './dropzone.mjs';
import { deliver } from './zip.mjs';
import { AppError } from './pdf.mjs';

/**
 * 幫工具頁掛好「拖放 → 執行 → 交付」嘅標準外殼。
 *
 * @param {object} opts
 * @param {(files: File[], ctx: { progress: (done: number, total: number) => void }) => Promise<Array<{name: string, bytes: Uint8Array}>>} opts.run
 *   實際業務邏輯。**進度顯示嘅重繪責任在 `run` 身上**：`ctx.progress(done, total)` 本身
 *   只係改咗 `msgEl.textContent`，唔會令瀏覽器即刻重繪畫面——單靠佢一個 call 唔夠。
 *   如果 `run` 入面係一個緊接一個、冇中斷嘅同步/microtask 迴圈（例如逐頁處理但冇 await
 *   任何嘢），瀏覽器會一路凍結到成個 job 做晒先重繪一次，進度條會由 0 直跳到 done，
 *   同完全冇進度顯示冇分別。
 *
 *   要令進度條真係逐步畫得出，`run` 每處理完一件輸入就必須喺呼叫
 *   `ctx.progress(done, total)` 之後 `await yieldToUI()`（本模組 export 嘅另一個函數），
 *   或者用等效嘅方式（例如 `await new Promise(r => setTimeout(r, 0))`）主動讓出主執行緒，
 *   等瀏覽器有機會 paint。冇呢一步，`ctx.progress` 齋叫係唔會有視覺效果的。
 * @returns {object} controller — 見 `ctrl` 的屬性：files／showError／showOk／showWarn／
 *   setProgress／clearMsg／clearFiles。
 */
export async function mountTool({
  dropEl, listEl, runBtn, msgEl,
  accept = 'pdf', multiple = false, sortable = false,
  zipName = 'pdf-toolbox.zip',
  run,
  onResult,       // 可選：提供就交俾佢處理輸出（例如合併頁先顯示大小再下載），唔即刻 deliver
  onFilesChange,  // 可選：檔案清單每次改變都叫（合併頁用嚟收起已過時嘅結果）
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

  // running 為 true 期間（見底下 runBtn click handler）拒絕任何令 ctrl.files
  // 改變嘅嘗試——唔淨係停用 dropzone（見 dz.setEnabled()，擋新增／拖放），
  // 仲要擋埋清單入面「移除」按鈕呢條唔經 dropzone、直接掉一個新 files 陣列
  // 落嚟嘅路徑（renderFileList 嘅 onChange）。冇呢層防護嘅話：run(ctrl.files, …)
  // 一開波就捕捉咗一個陣列參照，job 跑緊期間畫面上嘅清單郁咗，job 用嘅仍然
  // 係舊嗰份，但完成時照樣話俾用戶知「完成，已下載」——變成一個關於用戶
  // 已經改咗主意嘅選擇嘅假成功。
  let running = false;

  // sync() 係目前檔案清單嘅單一事實來源：更新 ctrl.files 之餘，
  // 一定要用 setFiles() 寫返入 dropzone 嘅內部 state（唔經 onChange，避免遞迴）——
  // 否則刪除／拖曳排序呢啲淨係經 renderFileList 觸發嘅改動，dropzone 完全唔知道，
  // 下次 take() 會用返 dropzone 嗰份舊 state 嚟 concat，令刪走嘅檔案「翻生」、
  // 手動排好嘅次序被打亂。
  const sync = files => {
    ctrl.files = files;
    dz.setFiles(files);
    if (listEl) renderFileList(listEl, files, { sortable, onChange: onListChange });
    if (runBtn) runBtn.disabled = files.length === 0;
    onFilesChange?.(files);
  };

  // 清單「移除」按鈕嘅改動入口：running 期間直接吞咗，唔會call落 sync()，
  // 等 ctrl.files／dz 內部 state 喺成個 job 期間保持不變。
  const onListChange = files => { if (!running) sync(files); };

  const dz = createDropzone(dropEl, {
    accept, multiple,
    onChange: (files, errKey, skipped) => {
      // 正常嚟講 running 期間 dz 已經被 setEnabled(false) 停用，take() 唔會
      // 行到呢度；呢個守衛係防禦性網，避免萬一有殘留事件漏網。
      if (running) return;
      if (errKey) { ctrl.showError(errKey); return; }
      if (skipped.limit > 0 && files.length > 0) {
        // 單檔模式下超出上限：話俾用戶知邊個檔案先係真正被留低嗰個，
        // 唔好淨係話「有檔案唔支援」（佢哋啲檔案類型可能完全冇問題）。
        ctrl.showWarn('warn.onlyFirstUsed', { name: skipped.keptName });
      } else if (skipped.type > 0 && files.length > 0) {
        ctrl.showWarn('warn.filesSkipped', { n: skipped.type });
      } else {
        clearMsg();
      }
      sync(files);
    },
  });
  ctrl.clearFiles = () => dz.clear();
  sync([]);

  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      if (ctrl.files.length === 0) { ctrl.showError('error.noFile'); return; }
      runBtn.disabled = true;
      running = true;
      dz.setEnabled(false);
      try {
        const outputs = await run(ctrl.files, {
          progress: (d, n) => ctrl.setProgress(d, n),
        });
        if (onResult) { clearMsg(); await onResult(outputs); }
        else { await deliver(outputs, zipName); ctrl.showOk('common.done'); }
      } catch (e) {
        if (e instanceof AppError) ctrl.showError(e.i18nKey, e.vars);
        else ctrl.showError('error.generic', { message: String(e && e.message || e) });
      } finally {
        runBtn.disabled = false;
        running = false;
        dz.setEnabled(true);
      }
    });
  }

  return ctrl;
}

// 每處理完一件就讓出主執行緒，令進度條真係畫得出
export const yieldToUI = () => new Promise(r => setTimeout(r, 0));
