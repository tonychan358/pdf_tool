// JSZip 只有 UMD build，冇 ESM。載入頁面必須有：
//   <script src="../vendor/jszip.min.js"></script>
// 本模組讀 window.JSZip。

import { AppError } from './errors.mjs';

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deliver(outputs, zipName) {
  // 冇任何輸出就落地一個「乜都冇做到」嘅檔案，成個 deliver 就會靜靜雞 return，
  // 上層（toolpage.mjs 嘅 run() click handler）跟手照樣顯示「完成，已下載」——
  // 使用者見到成功訊息但其實乜都冇落地。現時全部呼叫方每次都會回傳至少一項
  // 輸出，呢個分支理論上行唔到，但守住呢個不變量：一旦有新工具或者改壞
  // 邏輯令 outputs 變空，都要老實話俾用戶知，而唔係扮成功。
  if (outputs.length === 0) throw new AppError('error.noOutput');
  if (outputs.length === 1) {
    download(new Blob([outputs[0].bytes], { type: 'application/pdf' }), outputs[0].name);
    return;
  }
  if (!window.JSZip) {
    // 技術細節留喺 console 畀開發者查，唔好塞入使用者見到嗰句（佢哋做唔到任何嘢）。
    console.error('zip.mjs: window.JSZip is undefined — the page did not load vendor/jszip.min.js');
    throw new AppError('error.missingZip');
  }
  const zip = new window.JSZip();
  for (const o of outputs) zip.file(o.name, o.bytes);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  download(blob, zipName);
}
