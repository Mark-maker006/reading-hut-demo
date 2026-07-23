# Canvas Star Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time gold star particle trail behind the existing Reading Hut placement flyer without changing the flight, impact smoke, settle timing, or placement state flow.

**Architecture:** Keep Web Animations API as the source of truth for the flyer's motion. A single transparent Canvas reads the rendered flyer center on each animation frame, emits distance-spaced particles between consecutive positions, draws them below the flyer, and drains them after emission stops. Pure emission and lifecycle helpers stay exportable for deterministic Node tests; DOM and rendering orchestration remains in `reading-hut-placement-motion.js`.

**Tech Stack:** Native JavaScript, Canvas 2D, Web Animations API, SVG/CSS, Node test runner, Playwright.

---

### Task 1: Distance-spaced particle calculations

**Files:**
- Modify: `tests/reading-hut-placement-motion.test.js`
- Modify: `reading-hut-placement-motion.js`

- [ ] **Step 1: Write failing tests for interpolated emission and lifecycle curves**

Add tests that call the desired API before it exists:

```javascript
test('emission points stay continuous across short and fast movement', () => {
  assert.deepEqual(
    motion.createEmissionPoints({ x: 0, y: 0 }, { x: 3, y: 4 }, 6),
    [{ x: 3, y: 4 }],
  );

  const points = motion.createEmissionPoints({ x: 0, y: 0 }, { x: 24, y: 0 }, 6);
  assert.deepEqual(points, [
    { x: 6, y: 0 },
    { x: 12, y: 0 },
    { x: 18, y: 0 },
    { x: 24, y: 0 },
  ]);
});

test('particle lifecycle shrinks, fades, drifts, and expires', () => {
  assert.equal(motion.particleOpacity(0), 1);
  assert.equal(motion.particleOpacity(1), 0);
  assert.equal(motion.particleScale(0), 1);
  assert.equal(motion.particleScale(1), 0.3);

  const particle = {
    x: 10, y: 20, velocityX: 20, velocityY: -10,
    age: 100, lifetime: 500, rotation: 0, rotationSpeed: 2,
  };
  assert.deepEqual(motion.updateParticle(particle, 100), {
    x: 12, y: 19, velocityX: 20, velocityY: -10,
    age: 200, lifetime: 500, rotation: 0.2, rotationSpeed: 2,
  });
  assert.equal(motion.updateParticle(particle, 400), null);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/reading-hut-placement-motion.test.js
```

Expected: FAIL because `createEmissionPoints`, `particleOpacity`, `particleScale`, and `updateParticle` do not exist.

- [ ] **Step 3: Implement the minimum pure helpers**

Implement:

```javascript
function createEmissionPoints(previous, current, spacing) {
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [];
  const count = Math.max(1, Math.ceil(distance / spacing));
  return Array.from({ length: count }, function (_, index) {
    const progress = (index + 1) / count;
    return {
      x: rounded(previous.x + dx * progress),
      y: rounded(previous.y + dy * progress),
    };
  });
}

function particleOpacity(progress) {
  return rounded(Math.pow(1 - Math.min(1, Math.max(0, progress)), 1.6));
}

function particleScale(progress) {
  return rounded(1 - Math.min(1, Math.max(0, progress)) * 0.7);
}

function updateParticle(particle, deltaMs) {
  const age = particle.age + deltaMs;
  if (age >= particle.lifetime) return null;
  const seconds = deltaMs / 1000;
  return Object.assign({}, particle, {
    x: rounded(particle.x + particle.velocityX * seconds),
    y: rounded(particle.y + particle.velocityY * seconds),
    age: age,
    rotation: rounded(particle.rotation + particle.rotationSpeed * seconds),
  });
}
```

Export all four helpers from the UMD API.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `node --test tests/reading-hut-placement-motion.test.js` and expect all tests to pass.

### Task 2: Canvas trail runtime and cleanup

**Files:**
- Modify: `tests/reading-hut-placement-motion.test.js`
- Modify: `reading-hut-placement-motion.js`

- [ ] **Step 1: Write a failing lifecycle test**

Use a fake Canvas context, flyer rectangle, and patched `requestAnimationFrame` queue to verify that:

```javascript
const stop = motion.startStarTrail(canvas, layer, flyer);
assert.equal(typeof stop, 'function');
// Advance one frame, move the flyer, then advance again.
assert.ok(drawCalls.length > 0);
stop();
// Advance beyond maximum lifetime; no new RAF remains and Canvas is cleared.
assert.equal(pendingFrames.length, 0);
assert.ok(clearCalls.length > 0);
```

Also assert `startStarTrail(null, layer, flyer)` returns a safe no-op function.

- [ ] **Step 2: Run the focused test and verify RED**

Run `node --test tests/reading-hut-placement-motion.test.js`.

Expected: FAIL because `startStarTrail` is not defined.

- [ ] **Step 3: Implement Canvas orchestration**

Add `startStarTrail(canvas, layer, flyer)` with these exact responsibilities:

- Guard missing Canvas, context, RAF, layer, or flyer with a no-op stop function.
- Synchronize internal width and height from the layer rectangle using `devicePixelRatio` on every live frame.
- Read the transformed flyer center with `getBoundingClientRect()`.
- Emit one particle per six CSS pixels using `createEmissionPoints`.
- Choose roughly 60% gold stars, 25% cream dots, and 15% orange glints with 350–650ms lifetimes and 3–8px sizes.
- Update particles with elapsed milliseconds, clear the frame, and redraw with Canvas transforms.
- Return `stop(immediate)`: default stops emission and drains particles; `true` cancels RAF and clears immediately.
- Stop scheduling RAF once emission is disabled and the particle list is empty.

Export `startStarTrail` for focused lifecycle testing.

- [ ] **Step 4: Run focused tests and refactor while green**

Run `node --test tests/reading-hut-placement-motion.test.js`; keep the public helper names and cleanup semantics unchanged.

### Task 3: Connect the Canvas to the existing placement flow

**Files:**
- Modify: `tests/reading-hut-placement.test.js`
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`
- Modify: `reading-hut-placement-motion.js`

- [ ] **Step 1: Write failing markup and integration assertions**

Extend the native motion-layer test to require:

```javascript
assert.match(html, /<canvas class="placement-particle-canvas" aria-hidden="true"><\/canvas>/);
assert.match(html, /particleCanvas:\s*placementParticleCanvas,/);
assert.match(css, /\.placement-particle-canvas\s*\{[^}]*pointer-events:\s*none;[^}]*z-index:\s*2;/s);
```

- [ ] **Step 2: Run the single static test and verify RED**

Run:

```powershell
node --test --test-name-pattern "reading hut declares a native motion layer" tests/reading-hut-placement.test.js
```

Expected: FAIL because the Canvas markup and integration do not exist.

- [ ] **Step 3: Add markup, style, and option wiring**

Insert the Canvas between SVG trail and smoke markup, cache it as `placementParticleCanvas`, and pass it to `playPlacementMotion` as `particleCanvas`.

Set explicit stacking order:

```css
.placement-flight-trail { z-index: 1; }
.placement-particle-canvas {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.placement-flyer { z-index: 3; }
.placement-smoke-layer { z-index: 4; }
```

- [ ] **Step 4: Start and stop the trail without changing flight timing**

After appending the flyer, call:

```javascript
let stopStarTrailAnimation = startStarTrail(options.particleCanvas, layer, flyer);
```

Immediately after `await flightAnimation.finished`, call `stopStarTrailAnimation()` before the existing `impact()` call. In `finally`, call `stopStarTrailAnimation(true)` before removing the flyer and cleaning existing layers.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/reading-hut-placement-motion.test.js
node --test --test-name-pattern "reading hut declares a native motion layer" tests/reading-hut-placement.test.js
```

### Task 4: Regression and rendered verification

**Files:**
- Verify only; do not commit screenshots or temporary scripts.

- [ ] **Step 1: Run relevant regressions**

Run:

```powershell
node --test tests/reading-hut-placement-motion.test.js tests/reading-hut-placement.test.js
node --test tests/*.test.js
```

Record unrelated failures caused by pre-existing user changes separately from failures introduced by this feature.

- [ ] **Step 2: Verify the rendered interaction**

Serve the repository locally, open `reading-hut.html`, and test:

```text
Open furniture bag → purchase Reading Rug → click it again to place
→ Canvas is active during flight
→ gold/cream/orange particles trail behind the flyer
→ smoke and settle still play at impact
→ Canvas is blank and no RAF remains after completion
```

Verify one desktop viewport and the existing 394×852 mobile viewport, confirm no relevant console warnings/errors, and retain screenshots outside the repository as evidence.

