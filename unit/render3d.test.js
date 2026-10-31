const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'render3d.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'render3d.js' });

test('toWorld anchors home and maps outfield toward negative Z', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(context.toWorld(240, 375))), { x: 0, y: 0, z: 0 });
  const scaled = context.toWorld(280, 375, 12);
  assert.equal(scaled.x, 1);
  assert.ok(Math.abs(scaled.y - 0.3) < 1e-12);
  assert.equal(scaled.z, 0);
  assert.ok(context.toWorld(240, 100).z < 0);
});

test('camera cycle includes all four stable modes', () => {
  assert.equal(context.cameraModeNext('catcher'), 'wide');
  assert.equal(context.cameraModeNext('wide'), 'overhead');
  assert.equal(context.cameraModeNext('overhead'), 'auto');
  assert.equal(context.cameraModeNext('auto'), 'catcher');
  assert.equal(context.cameraModeNext('unknown'), 'catcher');
});

test('fielder facing is derived from two world positions', () => {
  assert.equal(context.fieldPlayerFacing({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2);
  assert.equal(context.fieldPlayerFacing({ x: 0, z: 0 }, { x: 0, z: -1 }), Math.PI);
});
