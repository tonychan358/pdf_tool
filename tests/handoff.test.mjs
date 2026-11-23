import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffTargets, isHandoffExpired, HANDOFF_TTL } from '../assets/core/handoff.mjs';

test('handoff is valid for less than one hour, expired at the boundary', () => {
  const createdAt = 1000;
  assert.equal(isHandoffExpired({ createdAt }, createdAt), false);
  assert.equal(isHandoffExpired({ createdAt }, createdAt + HANDOFF_TTL - 1), false);
  assert.equal(isHandoffExpired({ createdAt }, createdAt + HANDOFF_TTL), true);
  assert.equal(isHandoffExpired({ createdAt }, createdAt + HANDOFF_TTL + 1), true);
});

test('missing, invalid and future timestamps are not loaded', () => {
  for (const record of [null, {}, { createdAt: NaN }, { createdAt: '1000' }, { createdAt: 2000 }]) {
    assert.equal(isHandoffExpired(record, 1000), true);
  }
});

test('handoff cards exclude current tool and image input, and stay within three', () => {
  for (const current of ['merge', 'split', 'interleave', 'images-to-pdf', 'margin', 'nup', 'organize']) {
    const targets = handoffTargets(current);
    assert.ok(targets.length <= 3);
    assert.equal(targets.includes(current), false);
    assert.equal(targets.includes('images-to-pdf'), false);
    assert.equal(new Set(targets).size, targets.length);
  }
  assert.deepEqual(handoffTargets('merge'), ['margin', 'nup', 'organize']);
  assert.deepEqual(handoffTargets('margin'), ['nup', 'organize']);
});
