const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

// 描画呼び出しを数えるだけの Canvas 2D スタブ。getImageData の alpha で「破棄された」状態を再現する
function recordingCtx() {
  const ctx = {
    __fills: 0, __alpha: 255,
    fillRect() { ctx.__fills++; },
    beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, clip() {},
    moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, strokeRect() {},
    ellipse() {}, translate() {}, rotate() {}, setLineDash() {}, clearRect() {},
    createRadialGradient() { return { addColorStop() {} }; },
    getImageData() { return { data: [0, 0, 0, ctx.__alpha] }; }
  };
  return ctx;
}

function renderContext() {
  const bgCtx = recordingCtx();
  const canvases = [];
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {},
    getContext: () => recordingCtx()
  });
  const documentStub = {
    getElementById: () => element(),
    createElement: (tag) => {
      if (tag !== 'canvas') return element();
      const canvas = { width: 0, height: 0, __ctx: bgCtx, getContext: () => bgCtx };
      canvases.push(canvas);
      return canvas;
    },
    addEventListener() {},
    querySelectorAll: () => []
  };
  const context = {
    document: documentStub,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    __bgCtx: bgCtx
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'render.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('background field is painted once at load', () => {
  const context = renderContext();
  assert.ok(context.__bgCtx.__fills > 100, 'stands dots and surfaces should be painted');
});

test('ensureBg leaves a healthy background alone', () => {
  const context = renderContext();
  const before = context.__bgCtx.__fills;
  context.ensureBg();
  assert.equal(context.__bgCtx.__fills, before);
});

test('ensureBg repaints a purged background (iOS Safari drops background-tab canvases)', () => {
  const context = renderContext();
  const before = context.__bgCtx.__fills;
  context.__bgCtx.__alpha = 0; // キャンバスが破棄されて透明になった状態
  context.ensureBg();
  assert.ok(context.__bgCtx.__fills > before, 'purged background should be repainted');
});
