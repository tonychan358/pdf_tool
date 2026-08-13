import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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
