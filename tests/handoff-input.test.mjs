import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveHandoff } from '../assets/core/handoff.mjs';
import { createInputGuard } from '../assets/core/wizard-state.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

// Minimal asynchronous IndexedDB boundary: the actual consumeHandoff and
// receiveHandoff code run unchanged, including transaction completion.
function storage(read) {
  return { open() {
    const request = {};
    request.result = {
      close() {},
      transaction() {
        const tx = { objectStore: () => ({
          get() {
            const get = {};
            read.promise.then(record => {
              get.result = record;
              get.onsuccess();
              queueMicrotask(() => tx.oncomplete());
            });
            return get;
          },
          delete() {},
        }) };
        return tx;
      },
    };
    queueMicrotask(() => request.onsuccess());
    return request;
  } };
}

for (const scenario of ['success', 'missing', 'load failure', 'manual selection', 'job startup', 'stale error', 'rejected input']) {
  test(`relay input lifetime: ${scenario}`, async t => {
    const read = deferred(), loading = deferred(), entered = deferred();
    const previous = Object.fromEntries(['indexedDB', 'location', 'history'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.defineProperties(globalThis, {
      indexedDB: { configurable: true, value: storage(read) },
      location: { configurable: true, value: { href: 'http://localhost/tools/nup.html?handoff=test' } },
      history: { configurable: true, value: { state: null, replaceState() {} } },
    });
    t.after(() => {
      for (const [key, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    });
    const guard = createInputGuard();
    const messages = [];
    let selected = null;
    const pending = receiveHandoff({ targetTool: 'nup', inputGuard: guard,
      async onFile(file, lease) {
        assert.equal(guard.allows(lease), true);
        entered.resolve();
        await loading.promise;
        if (scenario === 'load failure') throw new Error('parse failed');
        if (scenario === 'rejected input') return false;
        selected = file.name;
      },
      onError: key => messages.push(key),
      onLoaded: name => messages.push(name),
    });
    try {
      assert.equal(guard.locked, true);
      assert.equal(guard.allows(), false);
      if (['manual selection', 'job startup', 'stale error'].includes(scenario)) {
        guard.invalidate();
        selected = 'manual.pdf';
      }
      read.resolve(['missing', 'stale error'].includes(scenario) ? undefined : {
        bytes: new Uint8Array([1]), name: 'relay.pdf', targetTool: 'nup', createdAt: Date.now(),
      });
      if (!['missing', 'manual selection', 'job startup', 'stale error'].includes(scenario)) {
        await entered.promise;
        assert.equal(guard.locked, true, 'lease covers asynchronous page loading too');
      }
      loading.resolve();
      await pending;
      assert.equal(guard.locked, false);
      assert.equal(guard.allows(), true);
      if (scenario === 'success') { assert.equal(selected, 'relay.pdf'); assert.deepEqual(messages, ['relay.pdf']); }
      else if (scenario === 'missing') assert.deepEqual(messages, ['handoff.missing']);
      else if (scenario === 'load failure') assert.deepEqual(messages, ['handoff.readFailed']);
      else { assert.deepEqual(messages, []); assert.equal(selected, scenario === 'rejected input' ? null : 'manual.pdf'); }
    } finally { read.resolve(); loading.resolve(); await pending; }
  });
}
