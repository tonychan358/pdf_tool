// 全站唯一載入 pdf.js 的模組。workerSrc／cMapUrl 一定要指向 vendor/，唔可以留空
// 或者指去 CDN——留空會令 pdf.js 靜靜地退回主執行緒渲染（慢、UI 會卡）；
// cMapUrl 錯就會令中文字型嘅字符對唔上，縮圖出現空白格（睇落似「冇字」）。
import * as pdfjs from '../../vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const CMAP_URL = new URL('../../vendor/pdfjs/cmaps/', import.meta.url).href;

const THUMB_WIDTH = 160;   // css px

// file → 逐頁 canvas，透過 onPage(index, canvas) 回呼；onProgress(done, total) 每頁完成後叫一次。
// 每頁 render 完之後 await 一次 setTimeout(0) 主動讓出主執行緒——冇呢步嘅話，
// 一份幾十頁嘅掃描會令瀏覽器由頭凍到尾，onProgress 嘅畫面完全睇唔到逐步更新。
export async function renderThumbs(file, onPage, onProgress = () => {}) {
  const data = new Uint8Array(await file.arrayBuffer());
  // getDocument() 本身返回嘅係 loadingTask，唔係文件本身——真正嘅
  // PDFDocumentProxy 要 await task.promise 先攞到。呢兩個係唔同物件，而
  // .destroy() 揸喺 loadingTask 度（喺呢個 vendored 版本 6.2.108，
  // PDFDocumentProxy 本身冇 .destroy 方法，得 loadingTask 有）——一定要留住
  // task 呢個參照，唔淨係 await 完個 promise 就掉咗佢。
  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  });

  // loadingTask 一叫出嚟就已經開緊一個 PDFWorker（起緊 worker thread、開始讀
  // 檔），唔使等 `.promise` resolve。所以 `await loadingTask.promise` 一定要
  // 擺入 try 入面——如果擺出面，一旦呢個 promise reject（pdf.js 用另一套
  // parser，同 pdf-lib 判斷唔一致嘅檔、或者 worker 中途壞咗），函數會喺入
  // try 之前就拋出，finally 唔會執行，個 worker／loadingTask 永遠冇機會
  // destroy——每中一次呢種檔就漏一個 worker，用戶好大機會會再拖多次嚟試，
  // 每次都再漏一個。
  try {
    const doc = await loadingTask.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      onPage(i - 1, canvas);
      onProgress(i, doc.numPages);
      await new Promise(r => setTimeout(r, 0));
    }
    return doc.numPages;
  } finally {
    // loadingTask 揸住 worker 端嘅資源——解碼緩衝、串流、成份檔案嘅複本。淨係
    // 等本地變量跌出 scope，唔會釋放任何一樣：無論係載入失敗（`.promise`
    // reject）、迴圈中途某一頁 render 失敗、定係正常行完，三條路都經呢個
    // finally，一定會叫 destroy()，唔會漏任何一種情況。
    //
    // 呼叫方（organize.html）仲有第四條路：呢一輪 render 中途畀用戶換咗檔／
    // 撳咗移除，變成「已被取代嘅世代」。呢個函數本身冇取消機制，冇辦法即刻
    // 停低——但呢個唔要緊：迴圈／載入照舊行到有結果為止，行完之後呢個
    // finally 照樣會 destroy，資源一樣會俾放返出嚟，淨係遲咗少少。
    //
    // destroy() 本身有內部 rethrow，都可以拋錯。用 try/catch 包住、淨係
    // console.warn 唔再拋出——釋放資源係 best-effort，唔可以喺 render 迴圈
    // 已經有一個「真正」錯誤緊喺度 propagate 緊嗰陣，被 destroy() 自己嗰個
    // 次要錯誤蓋過去，害使用者見到一個唔相關、唔知點跟進嘅訊息，而真正原因
    // 反而冇咗。
    //
    // 已喺瀏覽器內實測確認：destroy() 之後，之前已經 render 好嘅 canvas 完全
    // 唔受影響——canvas 一經 render() 完成就係一張獨立嘅 bitmap，同個
    // doc／worker 冇任何持續連繫，destroy 淨係斷開 doc 自己嗰便嘅資源，唔會令
    // 已經畫低嘅縮圖變空白。
    try {
      await loadingTask.destroy();
    } catch (destroyErr) {
      console.warn('thumbs.mjs: loadingTask.destroy() 本身拋錯，已吞咗唔再向上拋，避免蓋走原本嗰個錯誤', destroyErr);
    }
  }
}

// 壓縮：逐頁 render 做 JPEG，再以原頁面尺寸（已計旋轉）放返入新 PDF。
// 代價係文字變圖片、揀唔到／搜唔到——呼叫方要話俾用戶知。
// scale 1 ≈ 72 dpi；quality 係 canvas.toBlob 嘅 JPEG 質素（0–1）。
// signal：撤銷時喺下一頁之前停低，finally 照樣 destroy worker，唔會喺背景繼續食記憶體
export async function compressPdf(bytes, { scale, quality }, onProgress = () => {}, signal) {
  const { PDFDocument } = await import('../../vendor/pdf-lib.esm.min.js');
  // slice：pdf.js 會 transfer 個 buffer 去 worker，唔複製就會令呼叫方手上嗰份變空
  const loadingTask = pdfjs.getDocument({ data: bytes.slice(), cMapUrl: CMAP_URL, cMapPacked: true });
  try {
    const doc = await loadingTask.promise;
    const out = await PDFDocument.create();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    for (let i = 1; i <= doc.numPages; i++) {
      signal?.throwIfAborted();
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      ctx.fillStyle = '#fff'; // JPEG 冇透明，唔塗白底嘅話透明位會變黑
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
      const img = await out.embedJpg(await blob.arrayBuffer());
      out.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      onProgress(i, doc.numPages);
      await new Promise(r => setTimeout(r, 0));
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    try { await loadingTask.destroy(); } catch (e) { console.warn('compressPdf: destroy 失敗（已吞）', e); }
  }
}
