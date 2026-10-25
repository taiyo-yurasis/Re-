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

// A straight pitch lands exactly on its target, so dist() classifies the target point.
const pitchAt = (x, y) => ({ type: 's', x, y, sg: 1 });

test('dist: strike zone reaches the outer edge of the drawn frame (67.5px)', () => {
  const context = pitchContext();
  const dist = vm.runInContext('dist', context);
  assert.equal(dist(pitchAt(110, 110)), 0); // dead center
  assert.equal(dist(pitchAt(136, 110)), 0); // sweet band edge (26.4px)
  assert.equal(dist(pitchAt(137, 110)), 1);
  assert.equal(dist(pitchAt(176, 110)), 1); // on the frame center line (66px)
  assert.equal(dist(pitchAt(177, 110)), 1); // inside the frame's outer half (67px)
  assert.equal(dist(pitchAt(177.5, 110)), 1); // exactly the outer edge (67.5px)
  assert.equal(dist(pitchAt(178, 110)), 2); // just past the frame
  assert.equal(dist(pitchAt(177, 177)), 1); // corner of the frame counts too
  assert.equal(dist(pitchAt(209, 110)), 2); // near-outside band edge (99px)
  assert.equal(dist(pitchAt(210, 110)), 3); // clearly out
});
