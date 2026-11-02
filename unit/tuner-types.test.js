const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('tuner simulates every pitch type defined in TY', () => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), context, { filename: 'config.js' });
  const tyKeys = Object.keys(vm.runInContext('TY', context)).sort();

  const src = fs.readFileSync(path.join(root, 'tuner.js'), 'utf8');
  const m = src.match(/const types = \[([^\]]*)\]/);
  assert.ok(m, 'tuner.js must declare its pitch types');
  const tunerTypes = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();

  assert.deepEqual(tunerTypes, tyKeys);
});
