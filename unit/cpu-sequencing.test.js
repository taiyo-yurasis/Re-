const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function pitchContext() {
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  });
  const elements = new Map();
  const context = {
    document: {
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: () => element()
    },
    setTimeout, clearTimeout,
    performance: { now: () => 0 }
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'pitching.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

function planShares(context, level, b, s, prevPitch) {
  vm.runInContext(`G.cnt = { b: ${b}, s: ${s} }; G.prevPitch = ${JSON.stringify(prevPitch)};`, context);
  const plan = vm.runInContext('cpuPlanPitch', context);
  const counts = { s: 0, sh: 0, sl: 0, c: 0, cu: 0, f: 0 };
  let chase = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const p = plan(level);
    counts[p.type]++;
    const m = Math.max(Math.abs(p.x - 110), Math.abs(p.y - 110));
    if (m >= 78) chase++;
  }
  const out = {};
  for (const k of Object.keys(counts)) out[k] = counts[k] / N;
  out.chase = chase / N;
  return out;
}

test('cpuPlanPitch Lv4 follows the Statcast count table', () => {
  const context = pitchContext();
  const at30 = planShares(context, 4, 3, 0, null);
  assert.ok(at30.s + at30.sh > 0.78, `3-0 should be fastball-heavy, got s+sh=${(at30.s + at30.sh).toFixed(2)}`);
  assert.ok(at30.c < 0.03, '3-0 curve should almost vanish');
  const at02 = planShares(context, 4, 0, 2, null);
  assert.ok(at02.sh < 0.13, `0-2 two-seam should collapse, got ${at02.sh.toFixed(2)}`);
  assert.ok(at02.c + at02.cu + at02.f > 0.22, '0-2 putaway pitches should rise');
});

test('cpuPlanPitch Lv1 stays uniform and never plans a chase pitch', () => {
  const context = pitchContext();
  const sh = planShares(context, 1, 0, 2, null);
  for (const t of ['s', 'sh', 'sl', 'c', 'cu', 'f']) {
    assert.ok(sh[t] > 0.1 && sh[t] < 0.24, `Lv1 ${t} share ${sh[t].toFixed(2)} should be near 1/6`);
  }
  // No deliberate chase at Lv1: far targets only come from the legacy wide square (~10%)
  assert.ok(sh.chase < 0.15, `Lv1 far-target share ${sh.chase.toFixed(2)} should stay incidental`);
});

test('cpuPlanPitch repeats the pitch the batter whiffed at (Lv4 ~53%)', () => {
  const context = pitchContext();
  const sh = planShares(context, 4, 0, 2, { type: 'c', res: 'miss' });
  // Repeat rule fires 53%; the rest falls back to the 0-2 row where curve is 12%
  assert.ok(sh.c > 0.45, `whiffed curve should come back often, got ${sh.c.toFixed(2)}`);
  const lv2 = planShares(context, 2, 0, 2, { type: 'c', res: 'miss' });
  assert.ok(lv2.c < 0.25, 'Lv2 has no repeat rule');
  const fresh = planShares(context, 4, 0, 0, { type: 'c', res: 'miss' });
  assert.ok(fresh.c < 0.2, 'no repeat on the first pitch of an at-bat');
});

test('cpuPlanPitch chase intent: hunts outside with two strikes, stays in at three balls', () => {
  const context = pitchContext();
  const at02 = planShares(context, 4, 0, 2, null);
  assert.ok(at02.chase > 0.25 && at02.chase < 0.45, `0-2 chase share ${at02.chase.toFixed(2)} should be near 35%`);
  const at30 = planShares(context, 4, 3, 0, null);
  assert.ok(at30.chase < 0.12, 'three balls suppresses the chase');
  const lv3 = planShares(context, 3, 0, 2, null);
  assert.ok(lv3.chase > 0.08 && lv3.chase < 0.28, 'Lv3 chase is half strength');
});
