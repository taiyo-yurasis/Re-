const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createContext({ withAudio = false } = {}) {
  const store = {};
  const context = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    document: {
      getElementById: () => null,
      addEventListener: () => {}
    },
    __store: store
  };
  if (withAudio) {
    context.AudioContext = class {
      constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; this.started = 0; }
      resume() { this.state = 'running'; }
      suspend() { this.state = 'suspended'; }
      createBuffer(ch, len) { return { sampleRate: this.sampleRate, getChannelData: () => new Float32Array(len) }; }
      createBufferSource() { return { buffer: null, connect() {}, start: () => { context.__started = (context.__started || 0) + 1; }, stop() {} }; }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createBiquadFilter() { return { type: '', Q: { value: 0 }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start: () => { context.__started = (context.__started || 0) + 1; }, stop() {} }; }
    };
  }
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'sound.js'), 'utf8'), context, { filename: 'sound.js' });
  context.Snd = vm.runInContext('Snd', context);
  return context;
}

test('sound API exists and is enabled by default', () => {
  const context = createContext();
  assert.equal(typeof context.Snd.throw, 'function');
  assert.equal(typeof context.Snd.swing, 'function');
  assert.equal(typeof context.Snd.mitt, 'function');
  assert.equal(typeof context.Snd.hit, 'function');
  assert.equal(context.Snd.isEnabled(), true);
});

test('sound functions are safe no-ops without an AudioContext', () => {
  const context = createContext();
  context.Snd.throw();
  context.Snd.swing();
  context.Snd.mitt();
  context.Snd.hit('solid');
  context.Snd.hit(undefined);
});

test('mute preference persists and disables playback', () => {
  const context = createContext({ withAudio: true });
  context.Snd.setEnabled(false);
  assert.equal(context.Snd.isEnabled(), false);
  assert.equal(context.__store['yakyu-stadium-sound-enabled'], '0');
  context.Snd.swing();
  context.Snd.setEnabled(true);
  assert.equal(context.__store['yakyu-stadium-sound-enabled'], '1');
});

test('sound functions drive an AudioContext when available', () => {
  const context = createContext({ withAudio: true });
  context.Snd.throw();
  context.Snd.swing();
  context.Snd.mitt();
  context.Snd.hit('solid');
  context.Snd.hit('weak');
  // throw=2 bursts, swing=2 bursts, mitt=2 bursts+1 osc, hit=3 bursts+2 osc each
  assert.equal(context.__started, 17);
  context.Snd.setEnabled(false);
  context.Snd.swing();
  assert.equal(context.__started, 17);
});
