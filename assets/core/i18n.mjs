import { mountChrome } from './chrome.mjs';

const STORAGE_KEY = 'pdf-toolbox-lang';
const LOAD_ERROR_ID = 'i18n-load-error';
// 字典本身載入失敗，冇辦法用 t() 揾字（雞先定蛋先問題），呢句必須寫死雙語。
const LOAD_ERROR_TEXT = '無法載入介面文字，請重新整理頁面。 / Could not load interface text. Please reload the page.';
let dict = {};
let lang = 'zh';

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function t(key, vars = {}) {
  const raw = get(dict, key);
  if (raw === undefined) return key;
  return String(raw).replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in vars)) return m;
    const value = vars[k];
    return value && typeof value === 'object' && value.i18nKey
      ? t(value.i18nKey, value.vars) : String(value);
  });
}

export function currentLang() {
  return lang;
}

function apply(root = document) {
  document.getElementById(LOAD_ERROR_ID)?.remove(); // 呢次 load 成功，之前殘留嘅失敗橫幅要撤走
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n, el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : {});
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
    el.title = t(el.dataset.i18nLabel);
  });
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  const titleKey = document.body.dataset.titleKey;
  document.title = titleKey ? `${t(titleKey)} — ${t('app.title')}` : t('app.title');
}

function showLoadError() {
  if (document.getElementById(LOAD_ERROR_ID)) return; // 唔好疊加多過一條banner
  const el = document.createElement('div');
  el.id = LOAD_ERROR_ID;
  el.className = 'msg error';
  el.textContent = LOAD_ERROR_TEXT;
  document.body.prepend(el);
}

async function load(next) {
  const base = new URL('../i18n/', import.meta.url);
  try {
    const res = await fetch(new URL(`${next}.json`, base));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    dict = await res.json();
    lang = next;
    localStorage.setItem(STORAGE_KEY, next);
    apply();
  } catch (err) {
    showLoadError();
  }
}

let initialization;
export async function initI18n() {
  if (initialization) return initialization;
  mountChrome();
  initialization = initialize();
  return initialization;
}

async function initialize() {
  await load(localStorage.getItem(STORAGE_KEY) || 'zh');
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.addEventListener('click', () => load(lang === 'zh' ? 'en' : 'zh'));
  }
}

// 動態插入的元素填字後呼叫
export { apply as applyI18n };
