export function nextWizardStep(step, action, fileCount) {
  if (action === 'restart' || action === 'upload' || fileCount === 0) return 1;
  if (action === 'files' || action === 'adjust') return 2;
  if (action === 'complete') return 3;
  return step;
}

export function chooseDownload(original, compressed) {
  const smaller = !!compressed && compressed.length < original.length;
  return {
    bytes: smaller ? compressed : original,
    smaller,
    reduction: smaller ? Math.round((1 - compressed.length / original.length) * 100) : 0,
  };
}

// One shared input gate for manual selection, relay loading and job startup.
// A lease can load its own file, but cannot overwrite a newer selection/job.
export function createInputGuard(onChange = () => {}) {
  let generation = 0;
  const leases = new Map();
  const guard = {
    get locked() { return leases.size > 0; },
    invalidate() { generation++; },
    allows(lease) {
      return lease === undefined ? !guard.locked : leases.has(lease) && leases.get(lease) === generation;
    },
    acquire() {
      const lease = {};
      leases.set(lease, generation);
      onChange();
      return lease;
    },
    release(lease) { if (leases.delete(lease)) onChange(); },
    async hold(task) {
      const lease = guard.acquire();
      try { return await task(lease); }
      finally { guard.release(lease); }
    },
  };
  return guard;
}

// Snapshot only once per lock cycle. Repeated progress updates must not turn
// an originally enabled control into a permanently disabled one.
export function createControlLock() {
  const original = new Map();
  return {
    update(controls, locked) {
      if (locked) {
        for (const el of controls) {
          if (!original.has(el)) original.set(el, el.disabled);
          el.disabled = true;
        }
      } else {
        for (const [el, disabled] of original) el.disabled = disabled;
        original.clear();
      }
    },
  };
}
