import { t, applyI18n } from './i18n.mjs';
import { icon } from './chrome.mjs';
import { formatSize, sanitizeFileName } from './naming.mjs';
import { chooseDownload } from './wizard-state.mjs';
import { readPageCount } from './filemeta.mjs';
import { deliver } from './zip.mjs';
import { handoff, handoffTargets } from './handoff.mjs';

const levels = { light: { scale: 2, quality: .75 }, standard: { scale: 1.5, quality: .6 }, strong: { scale: 1, quality: .45 } };

export function mountCompletion(root, { zipName, onBusy, options = {} }) {
  const currentTool = options.currentTool || options.tool || location.pathname.split('/').pop().replace(/\.html$/, '');
  const targets = handoffTargets(currentTool);
  const titleKey = options.completeTitleKey || 'wizard.ready';
  const labelKey = options.resultLabelKey || 'wizard.resultLabel';
  root.innerHTML = `<div class="success-header"><div class="success-icon">${icon('check')}</div>
    <h2 tabindex="-1" data-completion-heading data-i18n="${titleKey}"></h2><p data-summary></p></div>
    <div class="result-grid" data-single>
      <div><div class="result-preview"><div class="result-preview-top"><span data-i18n="${labelKey}"></span>
        <span class="success-tag">${icon('check')}<span data-i18n="wizard.completed"></span></span></div>
        <div class="document-stack" aria-hidden="true"><div class="big-sheet"></div><span class="page-bubble" data-pages></span></div>
        <strong class="result-name" data-result-name></strong><p class="original-stats" data-result-meta></p></div>
        <label class="field-label" for="download-name" data-i18n="wizard.nameLabel"></label>
        <input type="text" class="name-edit" id="download-name" spellcheck="false" maxlength="120">
        <p class="result-details">${icon('lock')}<span data-i18n="wizard.saveNote"></span></p></div>
      <section class="download-panel" aria-labelledby="compression-title"><div class="toggle-row">
        <div><h3 id="compression-title" data-i18n="wizard.compress"></h3><p data-i18n="wizard.compressHint"></p></div>
        <label class="switch"><input type="checkbox" id="wantCompress" data-i18n-label="wizard.compress"><span class="switch-track"></span></label></div>
        <div data-compression-options hidden><fieldset class="compression-options"><legend data-i18n="wizard.compressionLevel"></legend>
          ${Object.keys(levels).map(level => `<label><input type="radio" name="compression-level" value="${level}" ${level === 'standard' ? 'checked' : ''}>
            <span><span data-i18n="wizard.${level}"></span><small data-i18n="wizard.${level}Hint"></small></span></label>`).join('')}
        </fieldset><div class="warning">${icon('warning')}<div><strong data-i18n="wizard.warningTitle"></strong><span data-i18n="wizard.warningBody"></span></div></div></div>
        <div class="compression-result" aria-live="polite"><div><small data-size-label></small><strong data-size></strong></div><span class="saving" data-saving hidden></span></div>
        <button type="button" class="btn download-btn" id="download">${icon('download')}<span data-i18n="wizard.downloadPdf"></span><span class="download-size" data-download-size></span></button>
        <p class="download-note" data-download-note></p><div class="msg" data-compress-msg role="status" hidden></div>
      </section>
    </div>
    <div data-multiple hidden><p data-multi-count></p><button type="button" class="btn download-btn" data-download-zip>${icon('download')}<span data-i18n="wizard.downloadZip"></span></button></div>
    <section class="next-tools" data-next aria-labelledby="next-title"><div class="next-tools-head"><div><h3 id="next-title" data-i18n="wizard.nextTitle"></h3><p data-i18n="wizard.nextHint"></p></div></div>
      <div class="next-grid">${targets.map(tool => { const key = { margin: 'Margin', nup: 'Nup', organize: 'Organize' }[tool]; return `<button type="button" class="next-tool" data-target-tool="${tool}">${icon(tool)}
        <span><strong data-i18n="wizard.next${key}"></strong><small data-i18n="wizard.next${key}Hint"></small></span>${icon('arrow')}</button>`; }).join('')}</div></section>
    <div class="msg" data-download-msg role="status" hidden></div>`;

  const $ = selector => root.querySelector(selector);
  const nameEl = $('#download-name');
  const toggle = $('#wantCompress');
  const downloadBtn = $('#download');
  let outputs = [], compressed = null, generation = 0, resultGeneration = 0, busy = false, touched = false;
  let note = null;
  const cache = new Map();
  let controller = null; // 進行中嘅壓縮；換級別／關閉／重設時撤銷，避免舊工作喺背景累積
  const text = (selector, key, vars = {}) => { $(selector).textContent = t(key, vars); };
  const message = (selector, cls, key, vars = {}) => {
    const el = $(selector);
    el.className = `msg ${cls}`;
    el.dataset.i18n = key;
    el.dataset.i18nVars = JSON.stringify(vars);
    el.textContent = t(key, vars);
    el.hidden = false;
  };
  const setBusy = value => {
    busy = value;
    downloadBtn.disabled = value;
    root.querySelectorAll('[data-target-tool]').forEach(btn => { btn.disabled = value; });
    onBusy(value);
  };
  const outputName = () => {
    const fallback = options.defaultNameKey ? t(options.defaultNameKey) : outputs[0]?.name?.replace(/\.pdf$/i, '') || t('common.untitled');
    return `${sanitizeFileName(nameEl.value.trim().replace(/\.pdf$/i, ''), fallback)}.pdf`;
  };
  const selected = () => chooseDownload(outputs[0].bytes, toggle.checked ? compressed : null);
  const repaint = () => {
    if (!outputs.length) return;
    const single = outputs.length === 1;
    $('[data-single]').hidden = !single;
    $('[data-multiple]').hidden = single;
    $('[data-next]').hidden = !single;
    const summary = options.completeSummary?.();
    $('[data-summary]').textContent = summary ? t(summary.key, summary.vars) : '';
    if (!single) { text('[data-multi-count]', 'wizard.multiResult', { n: outputs.length }); return; }
    const out = outputs[0];
    // 預設檔名隨語言更新；使用者一旦輸入，就不能覆蓋其選擇。
    if (!touched) nameEl.value = options.defaultNameKey ? `${t(options.defaultNameKey)}.pdf` : out.name;
    $('[data-result-name]').textContent = outputName();
    $('[data-pages]').textContent = out.pages ? t('wizard.pages', { n: out.pages }) : '';
    $('[data-result-meta]').textContent = out.pages
      ? t('wizard.resultMeta', { size: formatSize(out.bytes.length), n: out.pages }) : formatSize(out.bytes.length);
    const choice = selected();
    $('[data-compression-options]').hidden = !toggle.checked;
    text('[data-size-label]', choice.smaller ? 'wizard.compressedSize' : 'wizard.originalSize');
    $('[data-size]').textContent = busy ? '…' : formatSize(choice.bytes.length);
    $('[data-saving]').hidden = !choice.smaller || busy;
    text('[data-saving]', 'wizard.reduction', { pct: choice.reduction });
    $('[data-download-size]').textContent = busy ? '' : t('wizard.downloadSize', { size: formatSize(choice.bytes.length) });
    $('[data-download-note]').textContent = out.pages ? t('wizard.downloadNote', { n: out.pages }) : '';
    if (note) message('[data-compress-msg]', note.cls, note.key, note.vars);
    else $('[data-compress-msg]').hidden = true;
  };

  async function prepareCompression() {
    const ticket = ++generation;
    controller?.abort();
    controller = null;
    compressed = null;
    note = null;
    if (!outputs.length || outputs.length !== 1 || !toggle.checked) { setBusy(false); repaint(); return; }
    const out = outputs[0];
    const key = $('input[name="compression-level"]:checked').value;
    setBusy(true);
    note = { cls: 'ok', key: 'wizard.preparing' };
    repaint();
    try {
      if (!cache.has(key)) {
        const { compressPdf } = await import('./thumbs.mjs');
        if (ticket !== generation) return;
        controller = new AbortController();
        const bytes = await compressPdf(out.bytes, levels[key], (done, total) => {
          if (ticket !== generation) return;
          note = { cls: 'ok', key: 'wizard.compressing', vars: { done, total } };
          repaint();
        }, controller.signal);
        if (ticket !== generation) return;
        // 壓完反而大咗嘅結果唔會用，只記大小，唔留住 bytes
        cache.set(key, bytes.length < out.bytes.length ? bytes : { tooBig: bytes.length });
      }
      if (ticket !== generation) return;
      const entry = cache.get(key);
      compressed = entry.tooBig ? null : entry;
      note = entry.tooBig ? { cls: 'warn', key: 'wizard.notSmaller', vars: { size: formatSize(entry.tooBig) } } : null;
    } catch (e) {
      if (ticket !== generation) return;
      note = { cls: 'error', key: 'wizard.compressFailed', vars: { message: String(e?.message || e) } };
    } finally {
      // 舊的壓縮工作可能稍後完成，不能解鎖或覆蓋新選項的結果。
      if (ticket === generation) { setBusy(false); repaint(); }
    }
  }

  toggle.addEventListener('change', prepareCompression);
  root.querySelectorAll('[name="compression-level"]').forEach(input => input.addEventListener('change', prepareCompression));
  nameEl.addEventListener('input', () => { touched = true; repaint(); });
  downloadBtn.addEventListener('click', async () => {
    if (busy || outputs.length !== 1) return;
    try {
      await deliver([{ name: outputName(), bytes: selected().bytes }], zipName);
      message('[data-download-msg]', 'ok', 'wizard.downloaded');
    } catch (e) { message('[data-download-msg]', 'error', e.i18nKey || 'error.generic', e.vars || { message: String(e?.message || e) }); }
  });
  $('[data-download-zip]').addEventListener('click', async e => {
    if (busy || outputs.length < 2) return;
    e.currentTarget.disabled = true;
    setBusy(true);
    try { await deliver(outputs, zipName); message('[data-download-msg]', 'ok', 'wizard.downloaded'); }
    catch (err) { message('[data-download-msg]', 'error', err.i18nKey || 'error.generic', err.vars || { message: String(err?.message || err) }); }
    finally { $('[data-download-zip]').disabled = false; setBusy(false); }
  });
  root.querySelectorAll('[data-target-tool]').forEach(btn => btn.addEventListener('click', async () => {
    if (busy || outputs.length !== 1) return;
    setBusy(true);
    const transferControls = [nameEl, toggle, ...root.querySelectorAll('[name="compression-level"]')];
    transferControls.forEach(input => { input.disabled = true; });
    try {
      await handoff(outputs[0].bytes, outputName(), btn.dataset.targetTool);
    } catch (e) { message('[data-download-msg]', 'error', e.i18nKey || 'handoff.writeFailed'); }
    finally { transferControls.forEach(input => { input.disabled = false; }); setBusy(false); }
  }));
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  return {
    setOutputs(value, zipNameOverride) {
      this.reset();
      if (zipNameOverride) zipName = zipNameOverride;
      outputs = value;
      const ticket = resultGeneration;
      applyI18n(root);
      repaint();
      if (outputs.length === 1 && !outputs[0].pages) {
        const out = outputs[0];
        readPageCount(new File([out.bytes], out.name, { type: 'application/pdf' })).then(n => {
          if (ticket !== resultGeneration || outputs[0] !== out) return;
          out.pages = n;
          repaint();
        });
      }
    },
    reset() {
      generation++;
      controller?.abort();
      controller = null;
      resultGeneration++;
      outputs = [];
      compressed = null;
      cache.clear();
      touched = false;
      toggle.checked = false;
      $('input[value="standard"]').checked = true;
      note = null;
      $('[data-download-msg]').hidden = true;
      setBusy(false);
    },
  };
}
