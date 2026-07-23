const test = require('node:test');
const assert = require('node:assert/strict');

const motion = require('../reading-hut-placement-motion.js');

function createFakeSmokeLayer(playImplementation, options = {}) {
  const timers = new Map();
  const calls = { play: 0 };
  let currentTime = 0;
  let nextTimerId = 1;
  const ownerDocument = {
    defaultView: {
      performance: {
        now() {
          return currentTime;
        },
      },
      setTimeout(callback, delay) {
        const timerId = nextTimerId;
        nextTimerId += 1;
        timers.set(timerId, { callback, delay, dueAt: currentTime + delay });
        return timerId;
      },
      clearTimeout(timerId) {
        timers.delete(timerId);
      },
    },
    createElement(tagName) {
      const listeners = new Map();
      const customProperties = new Map();
      const element = {
        tagName,
        className: '',
        children: [],
        ownerDocument,
        parentNode: null,
        style: {
          setProperty(name, value) {
            customProperties.set(name, value);
          },
          getPropertyValue(name) {
            return customProperties.get(name) || '';
          },
        },
        appendChild(child) {
          if (child.parentNode && child.parentNode !== this) {
            child.parentNode.children = child.parentNode.children.filter((node) => node !== child);
          }
          child.parentNode = this;
          this.children.push(child);
          return child;
        },
        replaceChildren(...children) {
          this.children.forEach((child) => {
            child.parentNode = null;
          });
          this.children = [];
          children.forEach((child) => this.appendChild(child));
        },
        addEventListener(type, listener, options) {
          listeners.set(type, { listener, once: options && options.once === true });
        },
        removeEventListener(type, listener) {
          const registered = listeners.get(type);
          if (registered && registered.listener === listener) listeners.delete(type);
        },
        listenerCount() {
          return listeners.size;
        },
        dispatch(type) {
          const registered = listeners.get(type);
          if (!registered) return;
          if (registered.once) listeners.delete(type);
          registered.listener();
        },
        removeAttribute(name) {
          if (name === 'src') this.src = '';
          else delete this[name];
        },
      };

      if (tagName === 'video') {
        element.canPlayType = function () {
          return options.canPlayType === undefined ? 'probably' : options.canPlayType;
        };
        element.load = function () {};
        element.pause = function () {};
        element.play = function () {
          calls.play += 1;
          return playImplementation();
        };
      }
      if (tagName === 'img') {
        element.complete = options.imageComplete === true;
        element.naturalWidth = options.imageNaturalWidth ?? 512;
      }
      return element;
    },
  };

  const smokeLayer = ownerDocument.createElement('div');
  smokeLayer.calls = calls;
  smokeLayer.clock = {
    get pendingCount() {
      return timers.size;
    },
    get delays() {
      return Array.from(timers.values(), (timer) => timer.delay);
    },
    runNext() {
      const next = timers.entries().next().value;
      if (!next) return false;
      timers.delete(next[0]);
      currentTime = Math.max(currentTime, next[1].dueAt);
      next[1].callback();
      return true;
    },
    advance(milliseconds) {
      currentTime += milliseconds;
    },
  };
  return smokeLayer;
}

test('detects horizontal mirroring from independent scale and transform matrices', () => {
  assert.equal(motion.isHorizontallyMirrored('none', '-1 1'), true);
  assert.equal(motion.isHorizontallyMirrored('matrix(-1, 0, 0, 1, 0, 0)', 'none'), true);
  assert.equal(motion.isHorizontallyMirrored('matrix(1, 0, 0, 1, 0, 0)', 'none'), false);
  assert.equal(motion.isHorizontallyMirrored('matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)', 'none'), true);
});

test('flight geometry follows a five-keyframe curved path to the target orientation and size', () => {
  const geometry = motion.createFlightGeometry(
    { left: 10, top: 20, width: 20, height: 40 },
    { left: 210, top: 320, width: 40, height: 80 },
    { sourceMirrored: false, targetMirrored: true },
  );

  assert.equal(geometry.keyframes.length, 5);
  assert.deepEqual(geometry.keyframes.map((frame) => frame.offset), [0, 0.24, 0.52, 0.78, 1]);
  assert.match(geometry.path, /^M 20 40 C /);
  assert.match(geometry.path, / 230 360$/);
  assert.match(geometry.keyframes[0].transform, /rotateY\(0deg\)/);
  assert.match(geometry.keyframes.at(-1).transform, /translate3d\(200px, 300px, 0\)/);
  assert.match(geometry.keyframes.at(-1).transform, /scale\(2, 2\)/);
  assert.match(geometry.keyframes.at(-1).transform, /rotateY\(180deg\)/);
  assert.match(geometry.keyframes.at(-1).transform, /rotateZ\(0deg\)/);
});

test('same source and target orientation completes a full flip', () => {
  const normal = motion.createFlightGeometry(
    { left: 0, top: 0, width: 70, height: 47 },
    { left: 100, top: 200, width: 70, height: 47 },
    { sourceMirrored: false, targetMirrored: false },
  );
  const mirrored = motion.createFlightGeometry(
    { left: 0, top: 0, width: 70, height: 47 },
    { left: 100, top: 200, width: 70, height: 47 },
    { sourceMirrored: true, targetMirrored: true },
  );

  assert.match(normal.keyframes[0].transform, /rotateY\(0deg\)/);
  assert.match(normal.keyframes.at(-1).transform, /rotateY\(360deg\)/);
  assert.match(mirrored.keyframes[0].transform, /rotateY\(180deg\)/);
  assert.match(mirrored.keyframes.at(-1).transform, /rotateY\(540deg\)/);
});

test('fallback target keeps source size and centers it inside a structural slot', () => {
  assert.deepEqual(
    motion.createFallbackTarget(
      { left: 10, top: 20, width: 70, height: 47 },
      { left: 0, top: 341, width: 393, height: 511 },
    ),
    { left: 161.5, top: 573, width: 70, height: 47 },
  );
});

test('motion timing and smoke layout are deterministic and reusable', () => {
  assert.equal(motion.FLIGHT_DURATION_MS, 1100);
  assert.equal(motion.SMOKE_DURATION_MS, 1050);
  assert.equal(motion.TOTAL_DURATION_MS, 2200);
  assert.equal(motion.SMOKE_PUFFS.length, 9);
  assert.deepEqual(motion.SMOKE_PUFFS[0], { x: 0, y: 0, size: 0.72, delay: 0 });
  assert.ok(motion.SMOKE_PUFFS.some((puff) => puff.x < 0));
  assert.ok(motion.SMOKE_PUFFS.some((puff) => puff.x > 0));
});

test('smoke uses an animated WebP so file pages do not depend on VP9 playback', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());
  const target = { left: 10, top: 20, width: 40, height: 80 };

  assert.equal(motion.SMOKE_IMAGE_SRC, './assets/placement-smoke.webp');

  const smoke = motion.createSmoke(smokeLayer, target);

  assert.equal(smoke.tagName, 'img');
  assert.equal(smoke.className, 'placement-smoke-image');
  assert.equal(smoke.src, './assets/placement-smoke.webp');
  assert.equal(smoke.alt, '');
  assert.equal(smoke.draggable, false);
  assert.equal(smoke.style.left, '30px');
  assert.equal(smoke.style.top, '60px');
  assert.equal(smoke.style.getPropertyValue('--smoke-image-size'), '240px');
  assert.equal(smokeLayer.calls.play, 0);
});

test('image load keeps the animated smoke and clears its readiness timeout', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());
  const image = motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 32, height: 48 });

  assert.equal(smokeLayer.clock.pendingCount, 1);
  image.dispatch('load');

  assert.deepEqual(smokeLayer.children, [image]);
  assert.equal(image.listenerCount(), 0);
  assert.equal(smokeLayer.clock.pendingCount, 0);
});

test('image error falls back once to the legacy smoke and sparkle nodes', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());
  const image = motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 32, height: 48 });

  image.dispatch('error');
  image.dispatch('error');

  assert.equal(smokeLayer.children.length, 13);
  assert.equal(smokeLayer.children.filter((node) => node.className === 'placement-smoke-puff').length, 9);
  assert.equal(smokeLayer.children.filter((node) => node.className === 'placement-sparkle').length, 4);
});

test('disposing smoke prevents a late image error from mutating the layer', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());
  const image = motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 64, height: 64 });
  const sentinel = smokeLayer.ownerDocument.createElement('span');

  assert.equal(typeof image.dispose, 'function');
  image.dispose();
  smokeLayer.replaceChildren(sentinel);
  image.dispatch('error');

  assert.deepEqual(smokeLayer.children, [sentinel]);
  assert.equal(image.listenerCount(), 0);
  assert.equal(image.src, '');
  assert.equal(smokeLayer.clock.pendingCount, 0);
});

test('an old image error cannot replace a newer smoke image', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());
  const oldImage = motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 64, height: 64 });
  const newImage = motion.createSmoke(smokeLayer, { left: 100, top: 100, width: 64, height: 64 });

  oldImage.dispatch('error');

  assert.deepEqual(smokeLayer.children, [newImage]);
});

test('a cached broken image falls back immediately', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve(), {
    imageComplete: true,
    imageNaturalWidth: 0,
  });
  motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 64, height: 64 });

  assert.equal(smokeLayer.children.length, 13);
  assert.equal(smokeLayer.clock.pendingCount, 0);
  assert.equal(smokeLayer.children[0].style.getPropertyValue('--puff-delay'), '0ms');
  assert.equal(smokeLayer.children[9].style.getPropertyValue('--sparkle-delay'), '180ms');
});

test('missing readiness signal falls back within the smoke window', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());

  motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 64, height: 64 });

  assert.equal(motion.SMOKE_READINESS_TIMEOUT_MS, 325);
  assert.deepEqual(smokeLayer.clock.delays, [325]);
  assert.equal(smokeLayer.clock.runNext(), true);
  assert.equal(smokeLayer.children.length, 13);
  assert.equal(smokeLayer.clock.pendingCount, 0);
});

test('late readiness fallback fast-forwards legacy puff and sparkle delays', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());

  motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 64, height: 64 });
  smokeLayer.clock.runNext();

  const puffs = smokeLayer.children.filter((node) => node.className === 'placement-smoke-puff');
  const sparkles = smokeLayer.children.filter((node) => node.className === 'placement-sparkle');
  assert.equal(puffs[0].style.getPropertyValue('--puff-delay'), '-325ms');
  assert.equal(puffs[1].style.getPropertyValue('--puff-delay'), '-290ms');
  assert.equal(puffs[8].style.getPropertyValue('--puff-delay'), '-90ms');
  assert.deepEqual(
    sparkles.map((node) => node.style.getPropertyValue('--sparkle-delay')),
    ['-145ms', '-50ms', '45ms', '140ms'],
  );
});

test('legacy fallback elapsed time is clamped to the smoke duration', () => {
  const smokeLayer = createFakeSmokeLayer(() => Promise.resolve());
  const image = motion.createSmoke(smokeLayer, { left: 0, top: 0, width: 64, height: 64 });

  smokeLayer.clock.advance(2000);
  image.dispatch('error');

  assert.equal(smokeLayer.children[0].style.getPropertyValue('--puff-delay'), '-1050ms');
  assert.equal(smokeLayer.children[9].style.getPropertyValue('--sparkle-delay'), '-870ms');
});

test('emission points stay continuous across short and fast movement', () => {
  assert.deepEqual(
    motion.createEmissionPoints({ x: 0, y: 0 }, { x: 3, y: 4 }, 6),
    [{ x: 3, y: 4 }],
  );

  assert.deepEqual(
    motion.createEmissionPoints({ x: 0, y: 0 }, { x: 24, y: 0 }, 6),
    [
      { x: 6, y: 0 },
      { x: 12, y: 0 },
      { x: 18, y: 0 },
      { x: 24, y: 0 },
    ],
  );

  assert.deepEqual(
    motion.createEmissionPoints({ x: 8, y: 8 }, { x: 8, y: 8 }, 6),
    [],
  );
});

test('particle lifecycle shrinks, fades, drifts, rotates, and expires', () => {
  assert.equal(motion.particleOpacity(0), 1);
  assert.equal(motion.particleOpacity(1), 0);
  assert.ok(motion.particleOpacity(0.5) < 0.5);
  assert.equal(motion.particleScale(0), 1);
  assert.equal(motion.particleScale(1), 0.3);

  const particle = {
    x: 10,
    y: 20,
    velocityX: 20,
    velocityY: -10,
    age: 100,
    lifetime: 500,
    rotation: 0,
    rotationSpeed: 2,
  };

  assert.deepEqual(motion.updateParticle(particle, 100), {
    x: 12,
    y: 19,
    velocityX: 20,
    velocityY: -10,
    age: 200,
    lifetime: 500,
    rotation: 0.2,
    rotationSpeed: 2,
  });
  assert.equal(motion.updateParticle(particle, 400), null);
});

test('star trail follows the flyer, drains particles, and tears down its animation frame', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const originalDevicePixelRatio = globalThis.devicePixelRatio;
  const pendingFrames = new Map();
  const clearCalls = [];
  const fillCalls = [];
  let nextFrameId = 1;
  let flyerRect = { left: 10, top: 20, width: 20, height: 10 };

  const context = {
    setTransform() {},
    clearRect(...args) { clearCalls.push(args); },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    fill() { fillCalls.push(true); },
    globalAlpha: 1,
    fillStyle: '',
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return context; },
  };
  const layer = {
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 80 };
    },
  };
  const flyer = {
    getBoundingClientRect() {
      return flyerRect;
    },
  };

  function runNextFrame(timestamp) {
    const frame = pendingFrames.entries().next().value;
    assert.ok(frame, 'expected a pending animation frame');
    pendingFrames.delete(frame[0]);
    frame[1](timestamp);
  }

  globalThis.devicePixelRatio = 2;
  globalThis.requestAnimationFrame = function (callback) {
    const frameId = nextFrameId;
    nextFrameId += 1;
    pendingFrames.set(frameId, callback);
    return frameId;
  };
  globalThis.cancelAnimationFrame = function (frameId) {
    pendingFrames.delete(frameId);
  };

  try {
    const stop = motion.startStarTrail(canvas, layer, flyer);
    assert.equal(typeof stop, 'function');
    assert.equal(pendingFrames.size, 1);

    runNextFrame(0);
    flyerRect = { left: 40, top: 20, width: 20, height: 10 };
    runNextFrame(16);

    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 160);
    assert.ok(fillCalls.length > 0, 'moving the flyer should draw particles');

    stop();
    let timestamp = 116;
    while (pendingFrames.size > 0 && timestamp <= 1016) {
      runNextFrame(timestamp);
      timestamp += 100;
    }

    assert.equal(pendingFrames.size, 0);
    assert.ok(clearCalls.length > 0, 'the Canvas should be cleared while draining');
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    if (originalDevicePixelRatio === undefined) {
      delete globalThis.devicePixelRatio;
    } else {
      globalThis.devicePixelRatio = originalDevicePixelRatio;
    }
  }
});

test('missing Canvas safely disables the star trail', () => {
  const stop = motion.startStarTrail(null, {}, {});
  assert.equal(typeof stop, 'function');
  assert.doesNotThrow(() => stop(true));
});
