// AppError 獨立成一份細模組，等 pdf.mjs 同 zip.mjs 都可以各自 import，
// 唔使 zip.mjs 為咗一個錯誤類別而扯埋成個 pdf-lib bundle（pdf.mjs 入面嗰個）。
export class AppError extends Error {
  constructor(i18nKey, vars = {}) {
    super(i18nKey);
    this.i18nKey = i18nKey;
    this.vars = vars;
  }
}
