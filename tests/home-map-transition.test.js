const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const {
  TIMING,
  bootstrapHomeMapTransition,
  computeScatterDistance,
  computeScatterVector,
  createTransitionController,
} = require('../home-map-transition.js');
const { consumeMapEntryTransition } = require('../map-entry-transition.js');

function createScheduler() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();

  return {
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    runAt(time) {
      now = time;
      const due = Array.from(tasks.entries())
        .filter((entry) => entry[1].at <= now)
        .sort((left, right) => left[1].at - right[1].at);

      due.forEach(([id, task]) => {
        if (!tasks.delete(id)) return;
        task.callback();
      });
    },
    pendingCount() {
      return tasks.size;
    },
  };
}

function createClassList() {
  const names = new Set();
  return {
    add(...values) {
      values.forEach((value) => names.add(value));
    },
    remove(...values) {
      values.forEach((value) => names.delete(value));
    },
    contains(value) {
      return names.has(value);
    },
  };
}

function createElement(rect) {
  const attributes = new Map();
  const listeners = new Map();
  const properties = new Map();
  return {
    classList: createClassList(),
    style: {
      pointerEvents: '',
      setProperty(name, value) {
        properties.set(name, value);
      },
      removeProperty(name) {
        properties.delete(name);
      },
      getPropertyValue(name) {
        return properties.get(name) || '';
      },
    },
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) || new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type, listener) {
      const typeListeners = listeners.get(type);
      if (typeListeners) typeListeners.delete(listener);
    },
    dispatch(type) {
      const event = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      (listeners.get(type) || []).forEach((listener) => listener(event));
      return event;
    },
    listenerCount(type) {
      return (listeners.get(type) || new Set()).size;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    getBoundingClientRect() {
      return rect || { left: 0, top: 0, width: 0, height: 0 };
    },
  };
}

function createBrowserSurface(options) {
  const settings = options || {};
  const stageRect = settings.stageRect || { left: 0, top: 0, width: 393, height: 852 };
  const globalRect = (rect) => ({
    left: stageRect.left + rect.left,
    top: stageRect.top + rect.top,
    width: rect.width,
    height: rect.height,
  });
  const html = createElement({ left: 0, top: 0, width: 393, height: 852 });
  html.clientWidth = 393;
  html.clientHeight = 852;
  const body = createElement({ left: 0, top: 0, width: 393, height: 852 });
  const link = createElement(globalRect({ left: 275, top: 77, width: 82, height: 117 }));
  link.setAttribute('href', './level-map.html');
  const ipArt = createElement(globalRect({ left: 275, top: 77, width: 82, height: 117 }));
  const other = createElement(globalRect({ left: 0, top: 0, width: 20, height: 20 }));
  const pieces = [
    createElement(globalRect({ left: 16, top: 57, width: 220, height: 70 })),
    createElement(globalRect({ left: 17, top: 145, width: 359, height: 179 })),
    createElement(globalRect({ left: 17, top: 337, width: 359, height: 430 })),
    createElement(globalRect({ left: 17, top: 767, width: 359, height: 300 })),
    createElement(globalRect({ left: 0, top: 734, width: 393, height: 118 })),
  ];
  const stage = createElement(stageRect);
  const stageImages = [
    createElement(),
    createElement(),
    createElement(),
    createElement(),
    createElement(),
    createElement(),
    createElement(),
    createElement(),
    createElement(),
    createElement(),
  ];
  stageImages[0].setAttribute('src', './assets/map-transition-base-lanhu.png');
  stageImages[1].setAttribute('src', './assets/map-ui-back-lanhu.png');
  stageImages[2].setAttribute('src', './assets/map-ui-title-lanhu.png');
  stageImages[3].setAttribute('src', './assets/map-ui-star-panel-lanhu.png');
  stageImages[4].setAttribute('src', './assets/map-ui-star-lanhu.png');
  stageImages[5].setAttribute('src', './assets/map-ui-achievement-panel-lanhu.png');
  stageImages[6].setAttribute('src', './assets/map-ui-achievement-medal-lanhu.png');
  stageImages[7].setAttribute('src', './assets/map-house.png');
  stageImages[8].setAttribute('src', './assets/map-cloud-overlay.png');
  stageImages[9].setAttribute('src', './assets/map-final-lanhu.png');
  stage.querySelectorAll = (selector) => (selector === 'img' ? stageImages : []);

  const selectors = new Map([
    ['.hero-ip', link],
    ['.hero-ip-art', ipArt],
    ['.home-map-transition', stage],
  ]);
  const document = {
    documentElement: html,
    body,
    querySelector(selector) {
      return selectors.get(selector) || null;
    },
    querySelectorAll(selector) {
      return selector === '[data-home-transition-piece]' ? pieces : [];
    },
  };

  return { body, document, html, ipArt, link, other, pieces, stage };
}

function createStorage() {
  const values = new Map();
  return {
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    getItem(key) {
      return values.get(key) || null;
    },
  };
}

function createMapEntrySurface() {
  return {
    documentElement: {
      classList: createClassList(),
    },
  };
}

function extractCssBlock(source, headerPattern) {
  const headerIndex = source.search(headerPattern);
  if (headerIndex < 0) return null;

  const openingBrace = source.indexOf('{', headerIndex);
  if (openingBrace < 0) return null;

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) return source.slice(headerIndex, index + 1);
  }

  return null;
}

function extractCssLeafRules(source) {
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selectors: match[1].split(',').map((selector) => selector.trim()),
    declarations: match[2],
  }));
}

function setsOpacityToOne(declarations) {
  return /(?:^|;)\s*opacity\s*:\s*1(?:\.0+)?\s*(?:!important\s*)?(?:;|$)/i
    .test(declarations);
}

function readMarkupAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? match[2] : null;
}

function readMarkupClasses(tag) {
  return (readMarkupAttribute(tag, 'class') || '').split(/\s+/).filter(Boolean);
}

function extractMarkupElementByClass(source, tagName, className) {
  const openingPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let openingMatch;

  while ((openingMatch = openingPattern.exec(source))) {
    if (!readMarkupClasses(openingMatch[0]).includes(className)) continue;

    const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
    tagPattern.lastIndex = openingMatch.index;
    let depth = 0;
    let tagMatch;

    while ((tagMatch = tagPattern.exec(source))) {
      depth += tagMatch[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return source.slice(openingMatch.index, tagPattern.lastIndex);
    }
  }

  return null;
}

function parseDirectMapLayers(stage) {
  const openingMatch = stage.match(/^<div\b[^>]*>/i);
  const inner = stage.slice(openingMatch[0].length, stage.lastIndexOf('</div>'));
  const tagPattern = /<\/?div\b[^>]*>|<img\b[^>]*\/?\s*>/gi;
  const layers = [];
  let depth = 0;
  let directDiv = null;
  let tagMatch;

  while ((tagMatch = tagPattern.exec(inner))) {
    const tag = tagMatch[0];
    if (tag.startsWith('</')) {
      depth -= 1;
      if (depth === 0 && directDiv) {
        const fragment = inner.slice(directDiv.start, tagPattern.lastIndex);
        const imageTag = fragment.match(/<img\b[^>]*\/?\s*>/i);
        layers.push({
          tag: 'div',
          classes: readMarkupClasses(directDiv.openingTag),
          src: imageTag ? readMarkupAttribute(imageTag[0], 'src') : null,
        });
        directDiv = null;
      }
      continue;
    }

    if (tag.startsWith('<div')) {
      if (depth === 0) directDiv = { start: tagMatch.index, openingTag: tag };
      depth += 1;
      continue;
    }

    if (depth === 0) {
      layers.push({
        tag: 'img',
        classes: readMarkupClasses(tag),
        src: readMarkupAttribute(tag, 'src'),
      });
    }
  }

  return layers;
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) || new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type, listener) {
      const typeListeners = listeners.get(type);
      if (typeListeners) typeListeners.delete(listener);
    },
    dispatch(type, properties) {
      const event = Object.assign({ type }, properties);
      (listeners.get(type) || []).forEach((listener) => listener(event));
      return event;
    },
    listenerCount(type) {
      return (listeners.get(type) || new Set()).size;
    },
  };
}

test('exports the public transition timing contract', () => {
  assert.deepEqual(TIMING, {
    scatterDuration: 650,
    heroFadeDuration: 1000,
    mapRevealStart: 260,
    cloudStart: 520,
    settleStart: 1250,
    navigateAt: 1500,
    reducedNavigateAt: 180,
  });
  assert.equal(Object.isFrozen(TIMING), true);
});

test('computes a normalized center-to-center scatter direction', () => {
  const origin = { left: 150, top: 150, width: 100, height: 100 };
  const viewport = { width: 400, height: 800 };
  const leftPiece = computeScatterVector(
    origin,
    { left: 20, top: 160, width: 40, height: 40 },
    viewport,
  );
  const lowerPiece = computeScatterVector(
    origin,
    { left: 180, top: 600, width: 40, height: 40 },
    viewport,
  );

  assert.ok(leftPiece.x < 0);
  assert.ok(lowerPiece.y > 0);
  assert.ok(Math.abs(Math.hypot(leftPiece.x, leftPiece.y) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(lowerPiece.x, lowerPiece.y) - 1) < 1e-12);
  assert.equal(Number.isFinite(leftPiece.rotate), true);
  assert.equal(Number.isFinite(lowerPiece.rotate), true);
});

test('uses the offset viewport center when coincident scatter centers need a fallback', () => {
  const viewport = { left: 303.5, top: 40, width: 393, height: 852 };
  const centeredRect = {
    left: viewport.left + viewport.width / 2 - 20,
    top: viewport.top + viewport.height / 2 - 20,
    width: 40,
    height: 40,
  };

  assert.deepEqual(
    computeScatterVector(centeredRect, centeredRect, viewport),
    { x: 0, y: -1, rotate: 0 },
  );
});

test('computes the shortest distance that fully exits through the travel-facing edge', () => {
  assert.equal(typeof computeScatterDistance, 'function');
  const viewport = { width: 393, height: 852 };
  const margin = 24;
  const baseRect = { left: 100, top: 200, width: 80, height: 100 };
  const cases = [
    { name: 'left', rect: baseRect, vector: { x: -1, y: 0 }, expected: 204 },
    { name: 'right', rect: baseRect, vector: { x: 1, y: 0 }, expected: 317 },
    { name: 'top', rect: baseRect, vector: { x: 0, y: -1 }, expected: 324 },
    { name: 'bottom', rect: baseRect, vector: { x: 0, y: 1 }, expected: 676 },
    { name: 'diagonal', rect: baseRect, vector: { x: -0.6, y: -0.8 }, expected: 340 },
    {
      name: 'already outside',
      rect: { left: -100, top: 200, width: 50, height: 100 },
      vector: { x: -1, y: 0 },
      expected: 0,
    },
  ];

  cases.forEach(({ name, rect, vector, expected }) => {
    const distance = computeScatterDistance(rect, viewport, vector, margin);
    const moved = {
      left: rect.left + vector.x * distance,
      right: rect.left + rect.width + vector.x * distance,
      top: rect.top + vector.y * distance,
      bottom: rect.top + rect.height + vector.y * distance,
    };
    const fullyOutside = moved.right <= -margin + 1e-9
      || moved.left >= viewport.width + margin - 1e-9
      || moved.bottom <= -margin + 1e-9
      || moved.top >= viewport.height + margin - 1e-9;

    assert.ok(Math.abs(distance - expected) < 1e-9, `${name} distance`);
    assert.equal(fullyOutside, true, `${name} should finish fully outside`);
  });

  const oldDistance = Math.hypot(viewport.width, viewport.height)
    + Math.hypot(baseRect.width, baseRect.height);
  assert.ok(computeScatterDistance(baseRect, viewport, { x: -0.6, y: -0.8 }) < oldDistance / 2);
});

test('runs the exact state timeline once and marks the pending map handoff at start', () => {
  const scheduler = createScheduler();
  const storageWrites = [];
  const navigations = [];
  const stateChanges = [];
  const controller = createTransitionController({
    scheduler,
    storage: {
      setItem(key, value) {
        storageWrites.push([key, value]);
      },
    },
    navigate(destination) {
      navigations.push(destination);
    },
    destination: './level-map.html',
    onStateChange(state) {
      stateChanges.push(state);
    },
  });

  assert.equal(controller.getState(), 'idle');
  assert.equal(controller.start(), true);
  assert.equal(controller.start(), false);
  assert.equal(controller.getState(), 'scattering');
  assert.deepEqual(storageWrites, [['home-map-transition-v1', 'pending']]);

  scheduler.runAt(TIMING.mapRevealStart - 1);
  assert.equal(controller.getState(), 'scattering');
  scheduler.runAt(TIMING.mapRevealStart);
  assert.equal(controller.getState(), 'map-revealing');
  scheduler.runAt(TIMING.cloudStart - 1);
  assert.equal(controller.getState(), 'map-revealing');
  scheduler.runAt(TIMING.cloudStart);
  assert.equal(controller.getState(), 'cloud-covering');
  scheduler.runAt(TIMING.settleStart - 1);
  assert.equal(controller.getState(), 'cloud-covering');
  scheduler.runAt(TIMING.settleStart);
  assert.equal(controller.getState(), 'settling');
  scheduler.runAt(TIMING.navigateAt - 1);
  assert.equal(controller.getState(), 'settling');
  scheduler.runAt(TIMING.navigateAt);
  assert.equal(controller.getState(), 'navigating');
  scheduler.runAt(TIMING.navigateAt + 1000);

  assert.deepEqual(stateChanges, [
    'scattering',
    'map-revealing',
    'cloud-covering',
    'settling',
    'navigating',
  ]);
  assert.deepEqual(navigations, ['./level-map.html']);
});

test('reduced motion navigates once at the reduced delay', () => {
  const scheduler = createScheduler();
  const navigations = [];
  const controller = createTransitionController({
    scheduler,
    storage: null,
    reducedMotion: true,
    navigate() {
      navigations.push('navigate');
    },
  });

  controller.start();
  assert.equal(scheduler.pendingCount(), 1);
  scheduler.runAt(TIMING.reducedNavigateAt - 1);
  assert.deepEqual(navigations, []);
  scheduler.runAt(TIMING.reducedNavigateAt);
  assert.equal(controller.getState(), 'navigating');
  assert.deepEqual(navigations, ['navigate']);
  scheduler.runAt(TIMING.navigateAt);
  assert.deepEqual(navigations, ['navigate']);
});

test('dispose clears every scheduled callback and prevents navigation', () => {
  const scheduler = createScheduler();
  const navigations = [];
  const controller = createTransitionController({
    scheduler,
    storage: null,
    navigate() {
      navigations.push('navigate');
    },
  });

  assert.equal(controller.start(), true);
  assert.equal(scheduler.pendingCount(), 4);
  controller.dispose();
  assert.equal(scheduler.pendingCount(), 0);
  scheduler.runAt(TIMING.navigateAt + 1000);
  assert.deepEqual(navigations, []);
});

test('dispose removes a pending marker before navigation but preserves a committed handoff', () => {
  const markers = new Map();
  const storage = {
    setItem(key, value) {
      markers.set(key, value);
    },
    removeItem(key) {
      markers.delete(key);
    },
  };
  const cancelledScheduler = createScheduler();
  const cancelled = createTransitionController({
    scheduler: cancelledScheduler,
    storage,
    navigate() {},
  });

  cancelled.start();
  assert.equal(markers.get('home-map-transition-v1'), 'pending');
  cancelled.dispose();
  assert.equal(markers.has('home-map-transition-v1'), false);

  const committedScheduler = createScheduler();
  const committed = createTransitionController({
    scheduler: committedScheduler,
    storage,
    navigate() {},
  });

  committed.start();
  committedScheduler.runAt(TIMING.navigateAt);
  committed.dispose();
  assert.equal(markers.get('home-map-transition-v1'), 'pending');
});

test('reentrant disposal during scattering does not schedule callbacks', () => {
  const scheduler = createScheduler();
  const markers = new Map();
  const navigations = [];
  let controller;
  controller = createTransitionController({
    scheduler,
    storage: {
      setItem(key, value) {
        markers.set(key, value);
      },
      removeItem(key) {
        markers.delete(key);
      },
    },
    navigate() {
      navigations.push('navigate');
    },
    onStateChange(state) {
      if (state === 'scattering') controller.dispose();
    },
  });

  assert.equal(controller.start(), true);
  assert.equal(scheduler.pendingCount(), 0);
  assert.equal(markers.has('home-map-transition-v1'), false);
  scheduler.runAt(TIMING.navigateAt + 1000);
  assert.deepEqual(navigations, []);
});

test('reentrant disposal while entering navigation cancels the handoff', () => {
  const scheduler = createScheduler();
  const markers = new Map();
  const navigations = [];
  let controller;
  controller = createTransitionController({
    scheduler,
    storage: {
      setItem(key, value) {
        markers.set(key, value);
      },
      removeItem(key) {
        markers.delete(key);
      },
    },
    navigate(destination) {
      navigations.push(destination);
    },
    destination: './level-map.html',
    onStateChange(state) {
      if (state === 'navigating') controller.dispose();
    },
  });

  assert.equal(controller.start(), true);
  scheduler.runAt(TIMING.navigateAt);

  assert.deepEqual(
    {
      navigations,
      marker: markers.get('home-map-transition-v1'),
      pendingTimers: scheduler.pendingCount(),
    },
    {
      navigations: [],
      marker: undefined,
      pendingTimers: 0,
    },
  );
});

test('browser bootstrap binds and starts only the home IP link', () => {
  const surface = createBrowserSurface();
  const scheduler = createScheduler();
  const preloaded = [];
  function FakeImage() {
    Object.defineProperty(this, 'src', {
      set(value) {
        preloaded.push(value);
      },
    });
  }
  const transition = bootstrapHomeMapTransition({
    document: surface.document,
    scheduler,
    storage: null,
    navigate() {},
    Image: FakeImage,
  });

  assert.ok(transition);
  assert.equal(surface.link.listenerCount('click'), 1);
  assert.equal(surface.other.listenerCount('click'), 0);
  assert.equal(surface.other.dispatch('click').defaultPrevented, false);
  assert.equal(scheduler.pendingCount(), 0);

  const linkClick = surface.link.dispatch('click');
  assert.equal(linkClick.defaultPrevented, true);
  assert.equal(scheduler.pendingCount(), 4);
  assert.deepEqual(preloaded, [
    './assets/map-transition-base-lanhu.png',
    './assets/map-ui-back-lanhu.png',
    './assets/map-ui-title-lanhu.png',
    './assets/map-ui-star-panel-lanhu.png',
    './assets/map-ui-star-lanhu.png',
    './assets/map-ui-achievement-panel-lanhu.png',
    './assets/map-ui-achievement-medal-lanhu.png',
    './assets/map-house.png',
    './assets/map-cloud-overlay.png',
    './assets/map-final-lanhu.png',
  ]);
  assert.equal(surface.link.getAttribute('href'), './level-map.html');
});

test('home transition stage uses six ordered layers with one cloud overlay', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
  const stage = extractMarkupElementByClass(html, 'div', 'home-map-transition');

  assert.ok(stage);
  assert.deepEqual(parseDirectMapLayers(stage), [
    {
      tag: 'img',
      classes: ['transition-map-base'],
      src: './assets/map-transition-base-lanhu.png',
    },
    {
      tag: 'div',
      classes: ['transition-map-ui'],
      src: './assets/map-ui-back-lanhu.png',
    },
    {
      tag: 'img',
      classes: ['transition-map-house'],
      src: './assets/map-house.png',
    },
    {
      tag: 'div',
      classes: ['transition-focus-mask'],
      src: null,
    },
    {
      tag: 'img',
      classes: ['transition-map-cloud'],
      src: './assets/map-cloud-overlay.png',
    },
    {
      tag: 'img',
      classes: ['transition-map-preview'],
      src: './assets/map-final-lanhu.png',
    },
  ]);
  assert.equal((stage.match(/map-cloud-overlay\.png/g) || []).length, 1);
  assert.doesNotMatch(stage, /transition-cloud-piece/);
});

test('transition top UI uses independent Lanhu slices instead of a cropped map screenshot', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
  const ui = extractMarkupElementByClass(html, 'div', 'transition-map-ui');

  assert.ok(ui);
  assert.doesNotMatch(ui, /map-final-lanhu\.png/);
  for (const asset of [
    'map-ui-back-lanhu.png',
    'map-ui-title-lanhu.png',
    'map-ui-star-panel-lanhu.png',
    'map-ui-star-lanhu.png',
    'map-ui-achievement-panel-lanhu.png',
    'map-ui-achievement-medal-lanhu.png',
  ]) {
    assert.match(ui, new RegExp(`assets/${asset.replace('.', '\\.')}`));
  }
  assert.match(ui, />60<\/strong><small>\/100<\/small>/);
  assert.match(ui, />成就<\/span>/);
});

test('home IP link versions the complete map handoff document', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

  assert.match(
    html,
    /<a\b[^>]*class=["'][^"']*\bhero-ip\b[^"']*["'][^>]*href=["']\.\/level-map\.html\?v=20260722["'][^>]*>/i,
  );
});

test('browser bootstrap locks the IP link and maps controller states to the page', () => {
  const surface = createBrowserSurface();
  const scheduler = createScheduler();
  const transition = bootstrapHomeMapTransition({
    document: surface.document,
    scheduler,
    storage: null,
    navigate() {},
  });

  surface.link.dispatch('click');
  assert.equal(surface.link.getAttribute('aria-disabled'), 'true');
  assert.equal(surface.link.style.pointerEvents, 'none');
  assert.equal(surface.html.classList.contains('home-transitioning'), true);
  assert.equal(surface.body.classList.contains('home-transitioning'), true);
  assert.equal(surface.stage.classList.contains('is-active'), true);
  assert.match(surface.pieces[0].style.getPropertyValue('--scatter-x'), /px$/);
  assert.match(surface.pieces[0].style.getPropertyValue('--scatter-y'), /px$/);

  scheduler.runAt(TIMING.mapRevealStart);
  assert.equal(transition.getState(), 'map-revealing');
  assert.equal(surface.stage.classList.contains('is-map-revealing'), true);
  assert.equal(surface.html.classList.contains('home-map-revealing'), true);
  assert.equal(surface.body.classList.contains('home-map-revealing'), true);
  assert.equal(surface.stage.classList.contains('clouds-in'), false);

  scheduler.runAt(TIMING.cloudStart);
  assert.equal(transition.getState(), 'cloud-covering');
  assert.equal(surface.stage.classList.contains('clouds-in'), true);
  scheduler.runAt(TIMING.settleStart);
  assert.equal(surface.stage.classList.contains('is-settling'), true);
  scheduler.runAt(TIMING.navigateAt);
  assert.equal(surface.stage.classList.contains('is-navigating'), true);
});

test('browser bootstrap writes the shortest helper distance into every scatter vector', () => {
  assert.equal(typeof computeScatterDistance, 'function');
  const surface = createBrowserSurface();
  const scheduler = createScheduler();
  bootstrapHomeMapTransition({
    document: surface.document,
    scheduler,
    storage: null,
    navigate() {},
  });
  const originRect = surface.ipArt.getBoundingClientRect();
  const viewport = { width: 393, height: 852 };

  surface.link.dispatch('click');
  surface.pieces.forEach((piece) => {
    const pieceRect = piece.getBoundingClientRect();
    const vector = computeScatterVector(originRect, pieceRect, viewport);
    const expectedDistance = computeScatterDistance(pieceRect, viewport, vector);
    const scatterX = Number.parseFloat(piece.style.getPropertyValue('--scatter-x'));
    const scatterY = Number.parseFloat(piece.style.getPropertyValue('--scatter-y'));

    assert.ok(Math.abs(Math.hypot(scatterX, scatterY) - expectedDistance) < 0.02);
  });
});

test('centered wide-screen stage uses the same local scatter distance as a left-zero stage', () => {
  const leftZero = createBrowserSurface();
  const centered = createBrowserSurface({
    stageRect: { left: 303.5, top: 0, width: 393, height: 852 },
  });
  [leftZero, centered].forEach((surface) => {
    bootstrapHomeMapTransition({
      document: surface.document,
      scheduler: createScheduler(),
      storage: null,
      navigate() {},
    });
    surface.link.dispatch('click');
  });

  centered.pieces.forEach((piece, index) => {
    const leftZeroPiece = leftZero.pieces[index];
    const leftZeroDistance = Math.hypot(
      Number.parseFloat(leftZeroPiece.style.getPropertyValue('--scatter-x')),
      Number.parseFloat(leftZeroPiece.style.getPropertyValue('--scatter-y')),
    );
    const scatterX = Number.parseFloat(piece.style.getPropertyValue('--scatter-x'));
    const scatterY = Number.parseFloat(piece.style.getPropertyValue('--scatter-y'));
    const centeredDistance = Math.hypot(scatterX, scatterY);
    const global = piece.getBoundingClientRect();
    const local = {
      left: global.left - 303.5,
      top: global.top,
      right: global.left - 303.5 + global.width,
      bottom: global.top + global.height,
    };
    const fullyOutside = local.right + scatterX <= -24 + 0.02
      || local.left + scatterX >= 393 + 24 - 0.02
      || local.bottom + scatterY <= -24 + 0.02
      || local.top + scatterY >= 852 + 24 - 0.02;

    assert.ok(Math.abs(centeredDistance - leftZeroDistance) < 0.02);
    assert.equal(fullyOutside, true);
  });
});

test('repeated IP clicks do not create another browser transition timeline', () => {
  const surface = createBrowserSurface();
  const scheduler = createScheduler();
  bootstrapHomeMapTransition({
    document: surface.document,
    scheduler,
    storage: null,
    navigate() {},
  });

  surface.link.dispatch('click');
  assert.equal(scheduler.pendingCount(), 4);
  surface.link.dispatch('click');
  assert.equal(scheduler.pendingCount(), 4);
});

test('browser bootstrap disposal removes its listener, callbacks, pending handoff, and reveal classes', () => {
  const surface = createBrowserSurface();
  const scheduler = createScheduler();
  const storage = createStorage();
  const transition = bootstrapHomeMapTransition({
    document: surface.document,
    scheduler,
    storage,
    navigate() {},
  });

  surface.link.dispatch('click');
  assert.equal(storage.getItem('home-map-transition-v1'), 'pending');
  assert.equal(scheduler.pendingCount(), 4);
  scheduler.runAt(TIMING.mapRevealStart);
  assert.equal(surface.html.classList.contains('home-map-revealing'), true);
  assert.equal(surface.body.classList.contains('home-map-revealing'), true);
  assert.equal(surface.stage.classList.contains('is-map-revealing'), true);
  transition.dispose();

  assert.equal(scheduler.pendingCount(), 0);
  assert.equal(storage.getItem('home-map-transition-v1'), null);
  assert.equal(surface.link.listenerCount('click'), 0);
  assert.equal(surface.link.getAttribute('aria-disabled'), null);
  assert.equal(surface.link.style.pointerEvents, '');
  assert.equal(surface.html.classList.contains('home-map-revealing'), false);
  assert.equal(surface.body.classList.contains('home-map-revealing'), false);
  assert.equal(surface.stage.classList.contains('is-map-revealing'), false);
  assert.equal(surface.link.dispatch('click').defaultPrevented, false);
  scheduler.runAt(TIMING.navigateAt + 1000);
});

test('page lifecycle clears a completed transition and rebuilds a fresh controller after bfcache restore', () => {
  const surface = createBrowserSurface();
  const pageWindow = createEventTarget();
  const scheduler = createScheduler();
  const storage = createStorage();
  const transition = bootstrapHomeMapTransition({
    document: surface.document,
    window: pageWindow,
    scheduler,
    storage,
    navigate() {},
  });

  assert.equal(pageWindow.listenerCount('pagehide'), 1);
  assert.equal(pageWindow.listenerCount('pageshow'), 1);
  surface.link.dispatch('click');
  scheduler.runAt(TIMING.mapRevealStart);
  assert.equal(transition.getState(), 'map-revealing');
  assert.equal(surface.html.classList.contains('home-map-revealing'), true);
  assert.equal(surface.body.classList.contains('home-map-revealing'), true);
  assert.equal(surface.stage.classList.contains('is-map-revealing'), true);
  scheduler.runAt(TIMING.navigateAt);
  assert.equal(transition.getState(), 'navigating');
  assert.equal(storage.getItem('home-map-transition-v1'), 'pending');

  pageWindow.dispatch('pagehide', { persisted: true });
  assert.equal(surface.html.classList.contains('home-transitioning'), false);
  assert.equal(surface.body.classList.contains('home-transitioning'), false);
  assert.equal(surface.html.classList.contains('home-map-revealing'), false);
  assert.equal(surface.body.classList.contains('home-map-revealing'), false);
  assert.equal(surface.stage.classList.contains('is-active'), false);
  assert.equal(surface.stage.classList.contains('is-map-revealing'), false);
  assert.equal(surface.stage.classList.contains('clouds-in'), false);
  assert.equal(surface.stage.classList.contains('is-settling'), false);
  assert.equal(surface.stage.classList.contains('is-navigating'), false);
  assert.equal(surface.link.getAttribute('aria-disabled'), null);
  assert.equal(surface.link.style.pointerEvents, '');
  surface.pieces.forEach((piece) => {
    assert.equal(piece.style.getPropertyValue('--scatter-x'), '');
    assert.equal(piece.style.getPropertyValue('--scatter-y'), '');
    assert.equal(piece.style.getPropertyValue('--scatter-rotate'), '');
  });
  assert.equal(storage.getItem('home-map-transition-v1'), 'pending');

  pageWindow.dispatch('pageshow', { persisted: true });
  assert.equal(transition.getState(), 'idle');
  surface.link.dispatch('click');
  assert.equal(transition.getState(), 'scattering');
  assert.equal(scheduler.pendingCount(), 4);
  scheduler.runAt(TIMING.navigateAt + TIMING.mapRevealStart);
  assert.equal(transition.getState(), 'map-revealing');
  assert.equal(surface.html.classList.contains('home-map-revealing'), true);
  assert.equal(surface.body.classList.contains('home-map-revealing'), true);
  assert.equal(surface.stage.classList.contains('is-map-revealing'), true);

  transition.dispose();
  assert.equal(scheduler.pendingCount(), 0);
  assert.equal(storage.getItem('home-map-transition-v1'), null);
  assert.equal(surface.link.listenerCount('click'), 0);
  assert.equal(pageWindow.listenerCount('pagehide'), 0);
  assert.equal(pageWindow.listenerCount('pageshow'), 0);
});

test('preload construction and load errors mark the transition stage and disposal clears the fallback', () => {
  const throwingSurface = createBrowserSurface();
  let constructionAttempts = 0;
  function ThrowingImage() {
    constructionAttempts += 1;
    Object.defineProperty(this, 'src', {
      set() {
        throw new Error('image construction failed');
      },
    });
  }
  const throwingTransition = bootstrapHomeMapTransition({
    document: throwingSurface.document,
    storage: null,
    navigate() {},
    Image: ThrowingImage,
  });

  assert.equal(constructionAttempts, 10);
  assert.equal(throwingSurface.stage.classList.contains('has-preload-error'), true);
  throwingTransition.dispose();
  assert.equal(throwingSurface.stage.classList.contains('has-preload-error'), false);

  const errorSurface = createBrowserSurface();
  const images = [];
  function ErrorImage() {
    images.push(this);
  }
  const errorTransition = bootstrapHomeMapTransition({
    document: errorSurface.document,
    storage: null,
    navigate() {},
    Image: ErrorImage,
  });

  assert.equal(images.length, 10);
  images.forEach((image) => assert.equal(typeof image.onerror, 'function'));
  assert.equal(errorSurface.stage.classList.contains('has-preload-error'), false);
  images[0].onerror(new Error('404'));
  assert.equal(errorSurface.stage.classList.contains('has-preload-error'), true);
  errorTransition.dispose();
  images.forEach((image) => assert.equal(image.onerror, null));
  assert.equal(errorSurface.stage.classList.contains('has-preload-error'), false);
});

test('preload failure CSS reveals a mist throughout the visible map transition', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');

  assert.match(css, /\.home-map-transition::before\s*\{/);
  assert.match(css, /\.home-map-transition\.has-preload-error\.is-map-revealing::before/);
  assert.match(css, /\.home-map-transition\.has-preload-error\.clouds-in::before/);
  assert.match(css, /\.home-map-transition\.has-preload-error\.is-settling::before/);
});

test('home pieces use the v2 scatter and delayed fade timing', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const pieceRule = extractCssBlock(
    css,
    /\[data-home-transition-piece\]\s*\{/i,
  );
  const transitioningRule = extractCssBlock(
    css,
    /\.home-transitioning\s+\[data-home-transition-piece\]\s*\{/i,
  );

  assert.ok(pieceRule);
  assert.match(
    pieceRule,
    /transform\s+650ms\s+cubic-bezier\(0\.65\s*,\s*0\s*,\s*0\.35\s*,\s*1\)/i,
  );
  assert.match(pieceRule, /opacity\s+320ms\s+ease\s+300ms/i);
  assert.match(pieceRule, /filter\s+320ms\s+ease\s+300ms/i);
  assert.doesNotMatch(pieceRule, /will-change\s*:/i);
  assert.ok(transitioningRule);
  assert.match(transitioningRule, /opacity\s*:\s*0\s*;/i);
  assert.match(transitioningRule, /filter\s*:\s*blur\(2px\)\s*;/i);
  assert.match(
    transitioningRule,
    /will-change\s*:\s*transform\s*,\s*opacity\s*,\s*filter\s*;/i,
  );
});

test('tabbar preserves its centering transform while scattering and under reduced motion', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const reducedMotion = extractCssBlock(
    css,
    /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{/i,
  );
  const tabbarSelector = /^\.home-transitioning\s+\.tabbar\[data-home-transition-piece\]$/i;
  const normalRule = extractCssLeafRules(css)
    .find((rule) => rule.selectors.length === 1 && tabbarSelector.test(rule.selectors[0]));
  const reducedRule = extractCssLeafRules(reducedMotion)
    .find((rule) => rule.selectors.length === 1 && tabbarSelector.test(rule.selectors[0]));

  assert.ok(normalRule);
  assert.match(
    normalRule.declarations,
    /transform\s*:\s*translateX\(\s*-50%\s*\)\s*translate3d\(\s*var\(--scatter-x\)\s*,\s*var\(--scatter-y\)\s*,\s*0\s*\)\s*rotate\(\s*var\(--scatter-rotate\)\s*\)\s*scale\(\s*0\.96\s*\)\s*;/is,
  );
  assert.ok(reducedRule);
  assert.match(
    reducedRule.declarations,
    /transform\s*:\s*translateX\(\s*-50%\s*\)\s*;/i,
  );
  assert.doesNotMatch(
    reducedRule.declarations,
    /--scatter-|translate3d\s*\(|rotate\s*\(/i,
  );
});

test('transition stage keeps the fixed 393 by 852 clipped phone surface', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const stageRule = extractCssBlock(css, /\.home-map-transition\s*\{/i);

  assert.ok(stageRule);
  assert.match(stageRule, /position\s*:\s*fixed\s*;/i);
  assert.match(stageRule, /top\s*:\s*0\s*;/i);
  assert.match(stageRule, /left\s*:\s*50%\s*;/i);
  assert.match(stageRule, /width\s*:\s*min\(\s*393px\s*,\s*100vw\s*\)\s*;/i);
  assert.match(stageRule, /height\s*:\s*min\(\s*852px\s*,\s*100vh\s*\)\s*;/i);
  assert.match(stageRule, /overflow\s*:\s*hidden\s*;/i);
  assert.match(stageRule, /transform\s*:\s*translateX\(\s*-50%\s*\)\s*;/i);
});

test('single cloud and focus veil share the same seamless entrance motion', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const sharedRule = extractCssBlock(
    css,
    /\.transition-focus-mask\s*,\s*\.transition-map-cloud\s*\{/i,
  );
  const enteringRule = extractCssBlock(
    css,
    /\.home-map-transition\.clouds-in\s+\.transition-focus-mask\s*,\s*\.home-map-transition\.clouds-in\s+\.transition-map-cloud\s*\{/i,
  );

  assert.ok(sharedRule);
  assert.match(sharedRule, /transform\s*:\s*translate3d\(0\s*,\s*34%\s*,\s*0\)\s+scale\(1\.06\)\s*;/i);
  assert.match(sharedRule, /transform\s+660ms\s+cubic-bezier/i);
  assert.ok(enteringRule);
  assert.match(enteringRule, /opacity\s*:\s*1\s*;/i);
  assert.match(enteringRule, /transform\s*:\s*translate3d\(0\s*,\s*0\s*,\s*0\)\s+scale\(1\)\s*;/i);
  assert.doesNotMatch(css, /transition-cloud-piece/i);
});

test('hero art starts its longer fade with the click while leaving the status bar visible', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const heroRule = extractCssBlock(
    css,
    /\.hero-art\s*,\s*\.hero-mask\s*,\s*\.hero-ip-art\s*\{/i,
  );
  const revealRule = extractCssBlock(
    css,
    /\.home-transitioning\s+\.hero-art\s*,\s*\.home-transitioning\s+\.hero-mask\s*,\s*\.home-transitioning\s+\.hero-ip-art\s*\{/i,
  );

  assert.ok(heroRule);
  assert.match(heroRule, /transition\s*:\s*opacity\s+1000ms\s+cubic-bezier\(/i);
  assert.ok(revealRule);
  assert.match(revealRule, /opacity\s*:\s*0\s*;/i);
  assert.doesNotMatch(revealRule, /statusbar/i);
});

test('map reveal never targets the status bar with a hiding declaration', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const forbiddenRules = extractCssLeafRules(css).flatMap((rule) => (
    rule.selectors
      .filter((selector) => (
        /\.home-map-revealing\b/i.test(selector)
        && /\.statusbar\b/i.test(selector)
        && /(?:^|;)\s*(?:opacity\s*:|display\s*:\s*none\b|visibility\s*:\s*hidden\b)/i
          .test(rule.declarations)
      ))
  ));

  assert.deepEqual(forbiddenRules, []);
});

test('transition layers choreograph early UI, aerial map descent, and house landing', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const baseRule = extractCssBlock(css, /\.transition-map-base\s*\{/i);
  const baseRevealRule = extractCssBlock(
    css,
    /\.home-map-transition\.is-map-revealing\s+\.transition-map-base\s*\{/i,
  );
  const descentKeyframes = extractCssBlock(
    css,
    /@keyframes\s+transition-map-descent\s*\{/i,
  );
  const uiRule = extractCssBlock(css, /\.transition-map-ui\s*\{/i);
  const activeUiRule = extractCssBlock(
    css,
    /\.home-map-transition\.is-active\s+\.transition-map-ui\s*\{/i,
  );
  const houseRule = extractCssBlock(css, /\.transition-map-house\s*\{/i);
  const houseRevealRule = extractCssBlock(
    css,
    /\.home-map-transition\.is-map-revealing\s+\.transition-map-house\s*\{/i,
  );

  assert.ok(baseRule);
  assert.match(baseRule, /z-index\s*:\s*0\s*;/i);
  assert.match(baseRule, /opacity\s*:\s*0\s*;/i);
  assert.match(baseRule, /transform\s*:\s*scale\(1\.16\)\s*;/i);
  assert.match(baseRule, /filter\s*:\s*blur\(3px\)\s*;/i);
  assert.ok(baseRevealRule);
  assert.match(baseRevealRule, /animation\s*:\s*transition-map-descent\s+790ms\s+cubic-bezier/i);
  assert.ok(descentKeyframes);
  assert.match(descentKeyframes, /scale\(0\.985\)/i);
  assert.match(descentKeyframes, /scale\(1\)/i);
  assert.ok(uiRule);
  assert.match(uiRule, /translateY\(-12px\)/i);
  assert.match(uiRule, /opacity\s+200ms\s+ease-out\s+150ms/i);
  assert.ok(activeUiRule);
  assert.match(activeUiRule, /opacity\s*:\s*1\s*;/i);
  assert.ok(houseRule);
  assert.match(houseRule, /translateY\(-24px\)\s+scale\(1\.08\)/i);
  assert.match(houseRule, /transform\s+300ms\s+cubic-bezier/i);
  assert.ok(houseRevealRule);
  assert.match(houseRevealRule, /transition-delay\s*:\s*160ms\s*;/i);
});

test('focus window converges on the unlocked house before final map takeover', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const focusRule = extractCssBlock(css, /\.transition-focus-mask::after\s*\{/i);
  const focusAnimationRule = extractCssBlock(
    css,
    /\.home-map-transition\.clouds-in\s+\.transition-focus-mask::after\s*\{/i,
  );
  const focusKeyframes = extractCssBlock(
    css,
    /@keyframes\s+transition-focus-converge\s*\{/i,
  );
  const finalRule = extractCssBlock(
    css,
    /\.transition-map-preview\s*\{\s*z-index\s*:\s*6\s*;/i,
  );
  const settleRule = extractCssBlock(
    css,
    /\.home-map-transition\.is-settling\s+\.transition-map-preview\s*,\s*\.home-map-transition\.is-navigating\s+\.transition-map-preview\s*\{/i,
  );

  assert.ok(focusRule);
  assert.match(focusRule, /box-shadow\s*:/i);
  assert.ok(focusAnimationRule);
  assert.match(focusAnimationRule, /animation\s*:\s*transition-focus-converge\s+730ms/i);
  assert.ok(focusKeyframes);
  assert.match(focusKeyframes, /52%\s*\{/i);
  assert.match(focusKeyframes, /left\s*:\s*12%\s*;/i);
  assert.match(focusKeyframes, /top\s*:\s*14%\s*;/i);
  assert.ok(finalRule);
  assert.match(finalRule, /z-index\s*:\s*6\s*;/i);
  assert.match(finalRule, /opacity\s*:\s*0\s*;/i);
  assert.match(finalRule, /transition\s*:\s*opacity\s+250ms\s+ease/i);
  assert.ok(settleRule);
  assert.match(settleRule, /opacity\s*:\s*1\s*;/i);
});

test('temporary composition fades while the identical final frame takes over', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const temporaryFadeRule = extractCssBlock(
    css,
    /\.home-map-transition\.is-settling\s+\.transition-map-base[\s\S]*?\.home-map-transition\.is-navigating\s+\.transition-map-cloud\s*\{/i,
  );

  assert.ok(temporaryFadeRule);
  assert.match(temporaryFadeRule, /opacity\s*:\s*0\s*;/i);
});

test('preload fallback sits above every layer and covers every visible transition state', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const fallbackRule = extractCssBlock(css, /\.home-map-transition::before\s*\{/i);
  const visibleRule = extractCssBlock(
    css,
    /\.home-map-transition\.has-preload-error\.is-map-revealing::before\s*,\s*\.home-map-transition\.has-preload-error\.clouds-in::before\s*,\s*\.home-map-transition\.has-preload-error\.is-settling::before\s*,\s*\.home-map-transition\.has-preload-error\.is-navigating::before\s*\{/i,
  );

  assert.ok(fallbackRule);
  assert.match(fallbackRule, /z-index\s*:\s*7\s*;/i);
  assert.ok(visibleRule);
  assert.match(visibleRule, /opacity\s*:\s*1\s*;/i);
});

test('reduced motion skips movement and crossfades only the final map briefly', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const reducedMotion = extractCssBlock(
    css,
    /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{/i,
  );

  assert.ok(reducedMotion);
  const pieceRule = extractCssBlock(
    reducedMotion,
    /\[data-home-transition-piece\]\s*\{/i,
  );
  const movementRule = extractCssBlock(
    reducedMotion,
    /\.home-transitioning\s+\[data-home-transition-piece\]\s*,\s*\.home-transitioning\s+\.tabbar\[data-home-transition-piece\]\s*\{/i,
  );
  const temporaryRule = extractCssBlock(
    reducedMotion,
    /\.transition-map-base\s*,\s*\.transition-map-ui\s*,\s*\.transition-map-house\s*,\s*\.transition-focus-mask\s*,\s*\.transition-map-cloud\s*\{/i,
  );
  const finalRule = extractCssBlock(
    reducedMotion,
    /\.home-map-transition\.is-active\s+\.transition-map-preview\s*\{/i,
  );

  assert.ok(pieceRule);
  assert.match(pieceRule, /transition\s*:\s*opacity\s+180ms\s+ease\s*;/i);
  assert.ok(movementRule);
  assert.match(movementRule, /transform\s*:\s*none\s*;/i);
  assert.match(movementRule, /filter\s*:\s*none\s*;/i);
  assert.match(movementRule, /will-change\s*:\s*auto\s*;/i);
  assert.ok(temporaryRule);
  assert.match(temporaryRule, /display\s*:\s*none\s*;/i);
  assert.match(temporaryRule, /animation\s*:\s*none\s*;/i);
  assert.ok(finalRule);
  assert.match(finalRule, /opacity\s*:\s*1\s*;/i);
  assert.match(finalRule, /transform\s*:\s*none\s*;/i);
  assert.match(finalRule, /transition\s*:\s*opacity\s+180ms\s+ease\s*;/i);
  Array.from(reducedMotion.matchAll(/(\d+)ms\b/g), (match) => Number(match[1]))
    .forEach((duration) => assert.ok(duration <= 180));
});

test('map entry consumes a pending handoff and adds the entry class', () => {
  const storage = createStorage();
  const document = createMapEntrySurface();
  storage.setItem('home-map-transition-v1', 'pending');

  consumeMapEntryTransition({ document, storage });

  assert.equal(storage.getItem('home-map-transition-v1'), null);
  assert.equal(
    document.documentElement.classList.contains('map-entering-from-home'),
    true,
  );
});

test('browser script automatically consumes the handoff during head execution', () => {
  const source = readFileSync(
    join(__dirname, '..', 'map-entry-transition.js'),
    'utf8',
  );
  const document = createMapEntrySurface();
  let marker = 'pending';
  let removeCalls = 0;
  const sessionStorage = {
    getItem(key) {
      return key === 'home-map-transition-v1' ? marker : null;
    },
    removeItem(key) {
      if (key !== 'home-map-transition-v1') return;
      marker = null;
      removeCalls += 1;
    },
  };

  runInNewContext(source, { window: { document, sessionStorage } });

  assert.equal(marker, null);
  assert.equal(removeCalls, 1);
  assert.equal(
    document.documentElement.classList.contains('map-entering-from-home'),
    true,
  );
});

test('direct map load does not add the entry class', () => {
  const document = createMapEntrySurface();

  consumeMapEntryTransition({ document, storage: createStorage() });

  assert.equal(
    document.documentElement.classList.contains('map-entering-from-home'),
    false,
  );
});

test('a map handoff marker is consumed only once', () => {
  const storage = createStorage();
  const firstDocument = createMapEntrySurface();
  const refreshedDocument = createMapEntrySurface();
  storage.setItem('home-map-transition-v1', 'pending');

  consumeMapEntryTransition({ document: firstDocument, storage });
  consumeMapEntryTransition({ document: refreshedDocument, storage });

  assert.equal(
    firstDocument.documentElement.classList.contains('map-entering-from-home'),
    true,
  );
  assert.equal(
    refreshedDocument.documentElement.classList.contains('map-entering-from-home'),
    false,
  );
});

test('storage read failures do not throw or add the map entry class', () => {
  const document = createMapEntrySurface();
  const storage = {
    getItem() {
      throw new Error('storage unavailable');
    },
  };

  assert.doesNotThrow(() => consumeMapEntryTransition({ document, storage }));
  assert.equal(
    document.documentElement.classList.contains('map-entering-from-home'),
    false,
  );
});

test('storage removal failures do not throw or add the map entry class', () => {
  let marker = 'pending';
  const events = [];
  const names = new Set();
  const document = {
    documentElement: {
      classList: {
        add(value) {
          events.push('add');
          names.add(value);
        },
        remove(value) {
          events.push('remove');
          names.delete(value);
        },
        contains(value) {
          return names.has(value);
        },
      },
    },
  };
  const storage = {
    getItem() {
      return marker;
    },
    removeItem() {
      events.push('removeItem');
      throw new Error('storage unavailable');
    },
  };

  assert.equal(consumeMapEntryTransition({ document, storage }), false);
  assert.equal(marker, 'pending');
  assert.equal(
    document.documentElement.classList.contains('map-entering-from-home'),
    false,
  );
  assert.deepEqual(events, ['add', 'removeItem', 'remove']);
});

test('classList add failures preserve the pending handoff marker', () => {
  const storage = createStorage();
  storage.setItem('home-map-transition-v1', 'pending');
  const document = {
    documentElement: {
      classList: {
        add() {
          throw new Error('class list unavailable');
        },
      },
    },
  };

  assert.equal(consumeMapEntryTransition({ document, storage }), false);
  assert.equal(storage.getItem('home-map-transition-v1'), 'pending');
});

test('classList rollback failures are swallowed after storage removal fails', () => {
  const events = [];
  const document = {
    documentElement: {
      classList: {
        add() {
          events.push('add');
        },
        remove() {
          events.push('remove');
          throw new Error('class rollback unavailable');
        },
      },
    },
  };
  const storage = {
    getItem() {
      return 'pending';
    },
    removeItem() {
      events.push('removeItem');
      throw new Error('storage unavailable');
    },
  };

  assert.doesNotThrow(() => {
    assert.equal(consumeMapEntryTransition({ document, storage }), false);
  });
  assert.deepEqual(events, ['add', 'removeItem', 'remove']);
});

test('map entry bootstrap runs before the map stylesheet without defer', () => {
  const html = readFileSync(join(__dirname, '..', 'level-map.html'), 'utf8');
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);

  assert.ok(headMatch, 'level-map.html should contain a head element');
  const head = headMatch[1];
  const scriptMatch = head.match(
    /<script\b[^>]*src=["']\.\/map-entry-transition\.js["'][^>]*><\/script>/,
  );
  const stylesheetMatch = head.match(
    /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\.\/level-map\.css\?v=20260722["'][^>]*>/i,
  );

  assert.ok(scriptMatch, 'map entry script should be loaded inside head');
  assert.ok(stylesheetMatch, 'map stylesheet should be loaded inside head');
  assert.equal(/\bdefer\b/.test(scriptMatch[0]), false);
  assert.ok(head.indexOf(scriptMatch[0]) < head.indexOf(stylesheetMatch[0]));
});

test('map entry keeps the cached final art fully opaque without a second reveal animation', () => {
  const css = readFileSync(join(__dirname, '..', 'level-map.css'), 'utf8');
  const entryRule = extractCssBlock(
    css,
    /html\.map-entering-from-home\s+\.map-final-art\s*\{/i,
  );

  assert.ok(entryRule, 'map entry handoff rule should exist');
  assert.match(entryRule, /opacity\s*:\s*1\s*;/i);
  assert.match(entryRule, /animation\s*:\s*none\s*;/i);
  assert.doesNotMatch(css, /@keyframes\s+map-entry-opacity-stabilize/i);
  assert.doesNotMatch(css, /cloud[^{}]*\{[^}]*\b(?:animation|transform)\s*:/is);
});
