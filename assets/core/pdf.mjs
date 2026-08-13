import * as PDFLibNS from '../../vendor/pdf-lib.esm.min.js';
import { AppError } from './errors.mjs';
export const PDFLib = PDFLibNS;
export { AppError };

export async function loadPdf(file) {
  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new AppError('error.notPdf');
  }
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new AppError('error.corrupt');
  }
  try {
    return await PDFLibNS.PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (e) {
    const m = String(e && e.message);
    if (/encrypt/i.test(m)) throw new AppError('error.encrypted');
    if (/RangeError|out of memory|Array buffer allocation/i.test(m)) throw new AppError('error.oom');
    throw new AppError('error.corrupt');
  }
}

export async function newPdf() {
  return PDFLibNS.PDFDocument.create();
}

// start / end 為 1-indexed、頭尾包含
export async function copyRange(src, dest, start, end) {
  const indices = [];
  for (let p = start; p <= end; p++) indices.push(p - 1);
  const pages = await dest.copyPages(src, indices);
  pages.forEach(pg => dest.addPage(pg));
}

export async function save(doc) {
  return doc.save({ useObjectStreams: true });
}

// 判斷 PNG／JPG 靠 MIME type，退而求其次靠副檔名（同 dropzone.mjs 嘅 matches() 一致）。
// pdf-lib 兩個 embed 函式對唔啱格式嘅 bytes 會拋出各種內部錯誤，統一包成 AppError
// 等上層可以直接映射去 i18n 嘅「請拖入 JPG 或 PNG 圖片」。
export async function embedImage(doc, file) {
  const bytes = await file.arrayBuffer();
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  try {
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    throw new AppError('error.notImage');
  }
}
