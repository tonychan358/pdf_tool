const pageCounts = new WeakMap();

export async function readPageCount(file, read = async f => {
  const { loadPdf } = await import('./pdf.mjs');
  return (await loadPdf(f)).getPageCount();
}) {
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return null;
  try {
    const n = await read(file);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    // 頁數只是補充資訊；真正的讀檔錯誤留待執行時逐檔歸因。
    return null;
  }
}

export function getPageCount(file) {
  if (!pageCounts.has(file)) pageCounts.set(file, readPageCount(file));
  return pageCounts.get(file);
}

export function summarizeFiles(files, counts) {
  return {
    count: files.length,
    bytes: files.reduce((total, f) => total + f.size, 0),
    pages: counts.length === files.length && counts.every(n => Number.isInteger(n) && n > 0)
      ? counts.reduce((total, n) => total + n, 0) : null,
  };
}
