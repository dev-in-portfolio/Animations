const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['boids.html', 'particle-swarm.html'];

function extractInlineScript(html) {
  const match = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'expected an inline script');
  return match[1];
}

function runReducedMotionResizeTest(filename) {
  const html = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  const source = extractInlineScript(html);
  const windowListeners = new Map();
  const documentListeners = new Map();
  const canvasListeners = new Map();
  const animationFrames = new Map();
  let nextAnimationFrameId = 1;
  let drawCount = 0;
  let now = 0;

  const context2d = {
    setTransform() {},
    fillRect() { drawCount += 1; },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
  };

  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext() { return context2d; },
    addEventListener(type, listener) { canvasListeners.set(type, listener); },
  };

  const mediaQuery = {
    matches: true,
    addEventListener() {},
  };

  const sandbox = {
    console,
    Math,
    window: {
      innerWidth: 800,
      innerHeight: 600,
      devicePixelRatio: 2,
      matchMedia() { return mediaQuery; },
      addEventListener(type, listener) { windowListeners.set(type, listener); },
    },
    document: {
      hidden: false,
      getElementById() { return canvas; },
      addEventListener(type, listener) { documentListeners.set(type, listener); },
    },
    performance: {
      now() { return now; },
    },
    requestAnimationFrame(callback) {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      animationFrames.delete(id);
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
  };

  function flushAnimationFrame() {
    const pending = [...animationFrames.entries()];
    animationFrames.clear();
    assert.ok(pending.length > 0, `${filename} did not schedule a frame`);
    now += 16.6667;
    for (const [, callback] of pending) callback(now);
  }

  vm.runInNewContext(source, sandbox, { filename });
  flushAnimationFrame();
  assert.ok(drawCount > 0, `${filename} did not draw its initial reduced-motion frame`);

  drawCount = 0;
  const resize = windowListeners.get('resize');
  assert.equal(typeof resize, 'function', `${filename} did not register a resize handler`);
  resize();
  flushAnimationFrame();
  assert.ok(drawCount > 0, `${filename} stayed blank after a reduced-motion resize`);
}

for (const filename of FILES) {
  runReducedMotionResizeTest(filename);
}

console.log('Reduced-motion runtime smoke tests passed.');
