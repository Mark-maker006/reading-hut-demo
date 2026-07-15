# Placement Flight Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all seven placeable items rotate and transition smoothly from their Panel orientation to the final room orientation and size during native placement flight.

**Architecture:** Keep `reading-hut-placement-motion.js` as the reusable motion engine. Add pure helpers for horizontal-orientation parsing, fallback target geometry, and orientation-aware keyframes; let `reading-hut.html` pass both the placement slot and its final visual layer. Keep final room rendering and persisted placement state unchanged.

**Tech Stack:** Native HTML/CSS/JavaScript, Web Animations API, Node.js test runner, Playwright regression tests.

---

## File Map

- Modify `reading-hut-placement-motion.js`: orientation parsing, target geometry, five-keyframe 3D flight, 1100ms timing.
- Modify `reading-hut.html`: pass the final `.placement-item` separately from the placement slot.
- Modify `reading-hut.css`: keep hidden final layers measurable and add 3D flyer rendering properties.
- Modify `tests/reading-hut-placement-motion.test.js`: pure motion-engine regression tests.
- Modify `tests/reading-hut-placement.test.js`: page wiring, measurable target, and floor fallback assertions.

### Task 1: Orientation-aware flight geometry

**Files:**
- Modify: `tests/reading-hut-placement-motion.test.js`
- Modify: `reading-hut-placement-motion.js`

- [ ] **Step 1: Write failing pure-unit tests**

```js
test('detects horizontal mirroring from independent scale and transform matrices', () => {
  assert.equal(motion.isHorizontallyMirrored('none', '-1 1'), true);
  assert.equal(motion.isHorizontallyMirrored('matrix(-1, 0, 0, 1, 0, 0)', 'none'), true);
  assert.equal(motion.isHorizontallyMirrored('matrix(1, 0, 0, 1, 0, 0)', 'none'), false);
});

test('flight rotates from source orientation to target orientation and size', () => {
  const geometry = motion.createFlightGeometry(
    { left: 10, top: 20, width: 20, height: 40 },
    { left: 210, top: 320, width: 40, height: 80 },
    { sourceMirrored: false, targetMirrored: true },
  );
  assert.deepEqual(geometry.keyframes.map((frame) => frame.offset), [0, 0.24, 0.52, 0.78, 1]);
  assert.match(geometry.keyframes[0].transform, /rotateY\(0deg\)/);
  assert.match(geometry.keyframes.at(-1).transform, /scale\(2, 2\).*rotateY\(180deg\).*rotateZ\(0deg\)/);
});

test('same source and target orientation completes a full flip', () => {
  const geometry = motion.createFlightGeometry(
    { left: 0, top: 0, width: 70, height: 47 },
    { left: 100, top: 200, width: 70, height: 47 },
    { sourceMirrored: false, targetMirrored: false },
  );
  assert.match(geometry.keyframes.at(-1).transform, /rotateY\(360deg\)/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run `node --test tests/reading-hut-placement-motion.test.js`.

Expected: FAIL because `isHorizontallyMirrored` is missing and the current geometry has four keyframes without `rotateY()`.

- [ ] **Step 3: Implement pure orientation and keyframe helpers**

```js
const FLIGHT_DURATION_MS = 1100;

function isHorizontallyMirrored(transform, scale) {
  const scaleMatch = String(scale || '').match(/^\s*(-?\d*\.?\d+)/);
  if (scaleMatch && Number(scaleMatch[1]) < 0) return true;
  const matrixMatch = String(transform || '').match(/^matrix\(\s*(-?\d*\.?\d+)/);
  if (matrixMatch) return Number(matrixMatch[1]) < 0;
  const matrix3dMatch = String(transform || '').match(/^matrix3d\(\s*(-?\d*\.?\d+)/);
  return Boolean(matrix3dMatch && Number(matrix3dMatch[1]) < 0);
}

function orientationAngles(sourceMirrored, targetMirrored) {
  const start = sourceMirrored ? 180 : 0;
  let end = targetMirrored ? 180 : 0;
  if (end <= start) end += 360;
  return { start: start, end: end };
}
```

Update `createFlightGeometry(source, target, orientation)` to return five keyframes at offsets `0`, `0.24`, `0.52`, `0.78`, and `1`. Each transform retains translation and scale, adds `perspective(700px) rotateY(...)`, uses Z angles `-4`, `7`, `-5`, `2`, `0`, and ends at the exact target scale and target orientation. Export both helpers.

- [ ] **Step 4: Run unit tests and verify GREEN**

Run `node --test tests/reading-hut-placement-motion.test.js`.

Expected: all motion unit tests pass and `FLIGHT_DURATION_MS` equals `1100`.

### Task 2: Resolve final visual target and floor fallback

**Files:**
- Modify: `tests/reading-hut-placement-motion.test.js`
- Modify: `tests/reading-hut-placement.test.js`
- Modify: `reading-hut-placement-motion.js`
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`

- [ ] **Step 1: Write failing target-resolution and wiring tests**

```js
test('fallback target keeps source size and centers it inside a structural slot', () => {
  assert.deepEqual(
    motion.createFallbackTarget(
      { left: 10, top: 20, width: 70, height: 47 },
      { left: 0, top: 341, width: 393, height: 511 },
    ),
    { left: 161.5, top: 573, width: 70, height: 47 },
  );
});

assert.match(html, /targetVisualElement:\s*targetVisual/);
assert.match(html, /const targetVisual = targetSlot\.querySelector\('\.placement-item'\)/);
assert.match(css, /\.placement-item\s*\{[^}]*visibility:\s*hidden;/s);
assert.match(css, /\.placement-slot\.is-placed \.placement-item,[\s\S]*?visibility:\s*visible;/s);
```

- [ ] **Step 2: Run tests and verify RED**

Run `node --test tests/reading-hut-placement-motion.test.js tests/reading-hut-placement.test.js`.

Expected: FAIL because target visual wiring, measurable hidden layers, and `createFallbackTarget` do not exist.

- [ ] **Step 3: Implement visual-target resolution**

```js
function createFallbackTarget(source, slot) {
  return {
    left: slot.left + (slot.width - source.width) / 2,
    top: slot.top + (slot.height - source.height) / 2,
    width: source.width,
    height: source.height,
  };
}
```

In `playPlacementMotion(options)` calculate `targetSlot` from `targetElement`, use `targetVisualElement` when it exists, and otherwise call `createFallbackTarget(source, targetSlot)`. Read source and target styles with `getComputedStyle()` and pass the parsed orientations to `createFlightGeometry()`.

In `reading-hut.html`:

```js
const targetVisual = targetSlot.querySelector('.placement-item');
playPlacementMotion({
  layer: placementMotionLayer,
  trailPath: placementTrailPath,
  smokeLayer: placementSmokeLayer,
  sourceElement: sourceThumb,
  targetElement: targetSlot,
  targetVisualElement: targetVisual,
  imageSrc: item.img,
  onImpact: function () {
    targetSlot.classList.add('is-previewing');
  },
});
```

In `reading-hut.css`:

```css
.placement-item {
  visibility: hidden;
}

.placement-slot.is-placed .placement-item,
.placement-slot.is-previewing .placement-item {
  visibility: visible;
}

.placement-flyer {
  backface-visibility: visible;
  transform-style: preserve-3d;
}
```

Continue to use the slot for hit state and smoke. The wood-floor slot has no `.placement-item`, so it uses the centered source-size fallback.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run `node --test tests/reading-hut-placement-motion.test.js tests/reading-hut-placement.test.js`.

Expected: all focused motion and placement tests pass.

### Task 3: Regression and rendered verification

**Files:**
- Verify: `reading-hut.html`
- Verify: `reading-hut.css`
- Verify: `reading-hut-placement-motion.js`

- [ ] **Step 1: Run complete regression suite**

Run `node --test --test-concurrency=1 "tests/*.test.js"`.

Expected: zero failures across map, exchange, Panel, placement state, and motion tests.

- [ ] **Step 2: Run whitespace validation**

Run `git diff --check`.

Expected: exit code `0`; line-ending warnings are acceptable, whitespace errors are not.

- [ ] **Step 3: Verify the 393×852 rendered interaction**

Check a normal item, story wall, doll, and wood floor. Confirm takeoff orientation continuity, one smooth Y-axis flip, light Z-axis swing, exact landing size and direction, no wood-floor enlargement, unchanged smoke/settle effects, and no console errors.

- [ ] **Step 4: Commit the implementation**

```powershell
git add -- reading-hut-placement-motion.js reading-hut.html reading-hut.css tests/reading-hut-placement-motion.test.js tests/reading-hut-placement.test.js docs/superpowers/plans/2026-07-15-placement-flight-orientation.md
git commit -m "feat: animate placement orientation and target sizing"
```

