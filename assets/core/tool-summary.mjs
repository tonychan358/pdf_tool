import { t } from './i18n.mjs';
import { formatSize } from './naming.mjs';
import { getPageCount, summarizeFiles } from './filemeta.mjs';

export function createToolSummary(root, { images = false, outputPages = n => n } = {}) {
  let files = [], pages = 0, generation = 0, pending = false;
  const localized = (selector, key, vars = {}) => {
    const el = root.querySelector(selector);
    if (!el) return;
    el.dataset.i18n = key;
    el.dataset.i18nVars = JSON.stringify(vars);
    el.textContent = t(key, vars);
  };
  const repaint = () => {
    localized('[data-summary-count]', 'wizard.fileCount', { n: files.length });
    const pageKey = pending ? 'wizard.pagesPending' : pages === null ? 'wizard.pagesUnknown' : 'wizard.pages';
    localized('[data-summary-pages]', pageKey, { n: pages });
    localized('[data-summary-output-pages]', pageKey, { n: outputPages(pages) });
    root.querySelector('[data-summary-size]').textContent = formatSize(summarizeFiles(files, []).bytes);
  };
  root.querySelector('[data-step="2"]').addEventListener('change', repaint);
  return filesValue => {
    files = filesValue;
    const ticket = ++generation;
    pending = !images && files.length > 0;
    pages = images ? files.length : 0;
    repaint();
    if (images || !files.length) return;
    Promise.all(files.map(getPageCount)).then(counts => {
      if (ticket !== generation) return;
      pending = false;
      pages = summarizeFiles(files, counts).pages;
      repaint();
    });
  };
}
