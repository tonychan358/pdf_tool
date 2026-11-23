import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../assets/core/', import.meta.url));

test('assets/core 內全部 .mjs 語法正確', () => {
  const files = readdirSync(dir).filter(n => n.endsWith('.mjs'));
  assert.ok(files.length > 0, 'assets/core 內搵唔到任何 .mjs');
  for (const f of files) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--check', dir + f], { stdio: 'pipe' }),
      `${f} 語法錯誤`
    );
  }
});

test('首頁、工具頁及 mockup 的 inline scripts 語法正確', () => {
  const root = new URL('../', import.meta.url);
  const walk = url => readdirSync(url, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'vendor' || entry.name === 'node_modules') return [];
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
    return entry.isDirectory() ? walk(child) : entry.name.endsWith('.html') ? [child] : [];
  });
  for (const url of walk(root)) {
    const html = readFileSync(url, 'utf8');
    assert.match(html, /<!doctype html>/i, `${url.pathname} 缺少 doctype`);
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
      const module = /\btype\s*=\s*["']module["']/i.test(match[1]);
      assert.doesNotThrow(() => execFileSync(process.execPath,
        [...(module ? ['--input-type=module'] : []), '--check'],
        { input: match[2], stdio: ['pipe', 'pipe', 'pipe'] }), `${url.pathname} inline script 語法錯誤`);
    }
  }
});
