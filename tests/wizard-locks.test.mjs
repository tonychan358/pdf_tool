import test from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../assets/core/wizard-state.mjs';

test('input lease blocks ordinary inputs and only admits its current owner', () => {
  const changes = [];
  const guard = state.createInputGuard(() => changes.push(guard.locked));
  assert.equal(guard.allows(), true);
  const lease = guard.acquire();
  assert.equal(guard.locked, true);
  assert.equal(guard.allows(), false);
  assert.equal(guard.allows(lease), true);
  assert.equal(guard.allows({}), false);
  guard.invalidate(); // A newer manual selection or job supersedes the relay.
  assert.equal(guard.allows(lease), false);
  guard.release(lease);
  assert.equal(guard.allows(lease), false); // Released tokens cannot be reused.
  assert.equal(guard.allows(), true);
  assert.deepEqual(changes, [true, false]);
});

test('input leases release in finally on success and failure, without releasing another owner', async () => {
  const guard = state.createInputGuard();
  const outer = guard.acquire();
  await assert.rejects(guard.hold(async lease => {
    assert.equal(guard.allows(lease), true);
    await Promise.resolve();
    throw new Error('read failed');
  }), /read failed/);
  assert.equal(guard.locked, true);
  guard.release(outer);
  assert.equal(await guard.hold(async lease => guard.allows(lease)), true);
  assert.equal(guard.locked, false);
});

test('settings lock restores original disabled values after repeated updates and either outcome', async () => {
  for (const fail of [false, true]) {
    const enabled = { disabled: false }, disabled = { disabled: true };
    const lock = state.createControlLock();
    const controls = [enabled, disabled];
    try {
      lock.update(controls, true);
      lock.update(controls, true); // Progress/completion callbacks must not replace the snapshot.
      assert.ok(controls.every(el => el.disabled));
      if (fail) throw new Error('save failed');
    } catch (error) { assert.equal(error.message, 'save failed'); }
    finally { lock.update(controls, false); }
    assert.equal(enabled.disabled, false);
    assert.equal(disabled.disabled, true);
    lock.update(controls, false);
    assert.equal(disabled.disabled, true);
    disabled.disabled = false;
    lock.update(controls, true);
    lock.update(controls, false);
    assert.equal(disabled.disabled, false);
  }
});

test('settings lock includes controls added during a job and releases detached controls', () => {
  const first = { disabled: false }, added = { disabled: true };
  const lock = state.createControlLock();
  lock.update([first], true);
  lock.update([added], true);
  lock.update([added], false);
  assert.equal(first.disabled, false);
  assert.equal(added.disabled, true);
});
