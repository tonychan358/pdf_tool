import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = n => JSON.parse(readFileSync(new URL(`../assets/i18n/${n}.json`, import.meta.url), 'utf8'));

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

test('zh 同 en 的 key 完全一致', () => {
  const zh = flatten(load('zh')).sort();
  const en = flatten(load('en')).sort();
  const missingEn = zh.filter(k => !en.includes(k));
  const missingZh = en.filter(k => !zh.includes(k));
  assert.deepEqual(missingEn, [], `en.json 缺少：${missingEn.join(', ')}`);
  assert.deepEqual(missingZh, [], `zh.json 缺少：${missingZh.join(', ')}`);
});

test('冇空字串值', () => {
  for (const lang of ['zh', 'en']) {
    const walk = (o, p = '') => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'object' && v !== null) walk(v, `${p}${k}.`);
        else assert.notEqual(String(v).trim(), '', `${lang}.json 的 ${p}${k} 係空值`);
      }
    };
    walk(load(lang));
  }
});
