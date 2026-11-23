import test from 'node:test';
import assert from 'node:assert/strict';
import { nextWizardStep, chooseDownload } from '../assets/core/wizard-state.mjs';

test('精靈：沒有檔案時不能進入設定或下載', () => {
  for (const action of ['files', 'adjust', 'complete']) assert.equal(nextWizardStep(1, action, 0), 1);
});

test('精靈：加入檔案、完成、返回、重新開始', () => {
  assert.equal(nextWizardStep(1, 'files', 2), 2);
  assert.equal(nextWizardStep(2, 'complete', 2), 3);
  assert.equal(nextWizardStep(3, 'adjust', 2), 2);
  assert.equal(nextWizardStep(2, 'upload', 2), 1);
  assert.equal(nextWizardStep(3, 'restart', 2), 1);
});

test('精靈：結果過期或移除最後檔案，離開下載畫面', () => {
  assert.equal(nextWizardStep(3, 'files', 1), 2);
  assert.equal(nextWizardStep(2, 'files', 0), 1);
});

test('下載：只採用較小壓縮結果，保留原始 bytes', () => {
  const original = new Uint8Array(1000), compressed = new Uint8Array(300);
  const choice = chooseDownload(original, compressed);
  assert.equal(choice.bytes, compressed);
  assert.equal(choice.reduction, 70);
  assert.equal(choice.smaller, true);
  assert.equal(original.length, 1000);
});

test('下載：無壓縮、相同大小、壓縮更大，一律下載原檔', () => {
  const original = new Uint8Array(100);
  for (const compressed of [null, new Uint8Array(100), new Uint8Array(120)]) {
    assert.deepEqual(chooseDownload(original, compressed), { bytes: original, smaller: false, reduction: 0 });
  }
});
