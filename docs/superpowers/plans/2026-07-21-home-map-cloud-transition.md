# Home Map Cloud Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate home content radially away from the clicked IP, bring Lanhu cloud layers inward, and navigate seamlessly to the final map in about 820ms.

**Architecture:** A testable transition controller owns timing and navigation. CSS renders the radial exits and a fixed transition stage; four clipped views of one Lanhu cloud overlay move from the viewport edges to their final source-image positions before handing off to the baked clouds in `map-final-lanhu.png`.

**Tech Stack:** Static HTML/CSS, browser JavaScript, Node test runner, Playwright/Browser visual QA.

---

### Task 1: Acquire and verify the Lanhu cloud overlay

**Files:**
- Create: `assets/map-cloud-overlay.png`

- [ ] **Step 1: Download the `云朵-切图` source without recompression**

Use the Lanhu project item selected in the design file and save the original PNG as `assets/map-cloud-overlay.png`.

- [ ] **Step 2: Inspect source dimensions and alpha**

Run a PNG dimension/alpha check. Record the source dimensions in the CSS custom properties used by the transition stage and confirm the background is transparent or partially transparent.

### Task 2: Write controller tests first

**Files:**
- Create: `tests/home-map-transition.test.js`
- Create: `home-map-transition.js`

- [ ] **Step 1: Add failing tests for radial vectors and state timing**

The tests must require these exports before they exist:

```js
const {
  TIMING,
  computeScatterVector,
  createTransitionController,
} = require('../home-map-transition.js');
```

Cover:

```js
assert.ok(leftPiece.x < 0);
assert.ok(lowerPiece.y > 0);
assert.equal(controller.start(), true);
assert.equal(controller.start(), false);
scheduler.runAt(TIMING.cloudStart);
assert.equal(controller.getState(), 'cloud-covering');
scheduler.runAt(TIMING.settleStart);
assert.equal(controller.getState(), 'settling');
scheduler.runAt(TIMING.navigateAt);
assert.equal(navigations.length, 1);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/home-map-transition.test.js
```

Expected: FAIL because `home-map-transition.js` does not yet export the required API.

- [ ] **Step 3: Implement the pure controller API**

Use these public timing values:

```js
const TIMING = Object.freeze({
  scatterDuration: 400,
  cloudStart: 220,
  settleStart: 700,
  navigateAt: 820,
  reducedNavigateAt: 180,
});
```

`computeScatterVector(originRect, targetRect, viewport)` must normalize the center-to-center vector and return `{ x, y, rotate }`. `createTransitionController(options)` must expose `start()`, `getState()`, and `dispose()`; dependencies such as scheduler, storage, navigation, and DOM mutation callbacks must be injectable for deterministic tests.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command and expect all controller tests to pass.

### Task 3: Wire the homepage transition surface

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `home-map-transition.js`
- Test: `tests/home-map-transition.test.js`

- [ ] **Step 1: Mark the radial pieces and add the transition stage**

Add `data-home-transition-piece` to `.profile`, `.weekly`, `.reading-card`, `.next-plan`, and `.tabbar`. Add this fixed, hidden stage near the end of `<main>`:

```html
<div class="home-map-transition" aria-hidden="true">
  <img class="transition-map-preview" src="./assets/map-final-lanhu.png" alt="" />
  <div class="transition-cloud-piece transition-cloud-piece--top"><img src="./assets/map-cloud-overlay.png" alt="" /></div>
  <div class="transition-cloud-piece transition-cloud-piece--left"><img src="./assets/map-cloud-overlay.png" alt="" /></div>
  <div class="transition-cloud-piece transition-cloud-piece--right"><img src="./assets/map-cloud-overlay.png" alt="" /></div>
  <div class="transition-cloud-piece transition-cloud-piece--bottom"><img src="./assets/map-cloud-overlay.png" alt="" /></div>
</div>
<script src="./home-map-transition.js" defer></script>
```

- [ ] **Step 2: Add responsive exit and cloud CSS**

Use CSS variables set by the controller:

```css
[data-home-transition-piece] {
  transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease, filter 360ms ease;
}

.home-transitioning [data-home-transition-piece] {
  transform: translate3d(var(--scatter-x), var(--scatter-y), 0) rotate(var(--scatter-rotate)) scale(0.96);
  opacity: 0;
  filter: blur(2px);
}
```

The fixed stage must be viewport-clipped. Each cloud wrapper contains a full-size copy of the cloud source, uses a source-coordinate clip region, starts translated beyond its corresponding edge, and transitions to `translate3d(0, 0, 0)`.

- [ ] **Step 3: Bootstrap from the existing IP link**

On DOM ready, locate `.hero-ip`, `.hero-ip-art`, the transition pieces, and the stage. Prevent the link's immediate navigation, compute vectors, preload the two transition images, set the CSS variables, and call the controller. Preserve the link's original `href` as the final destination.

- [ ] **Step 4: Extend tests for browser bootstrap contracts**

Assert that only the IP link starts the transition, the link is locked during the run, repeated starts do not add timers, and disposal clears every scheduled callback.

### Task 4: Add the single-use map handoff

**Files:**
- Create: `map-entry-transition.js`
- Modify: `level-map.html`
- Modify: `level-map.css`
- Test: `tests/home-map-transition.test.js`

- [ ] **Step 1: Consume the home-transition marker before map paint**

`map-entry-transition.js` reads `sessionStorage['home-map-transition-v1']`. When it equals `pending`, remove it and add `map-entering-from-home` to `<html>`. Direct loads and refreshes must leave the class absent.

- [ ] **Step 2: Add a minimal final-frame stabilization style**

Keep the final composite visible and use only a short opacity stabilization when the class exists; do not replay cloud movement on the map page.

- [ ] **Step 3: Test marker consumption**

Verify the marker is consumed once, direct map loads do not add the class, and storage failures do not block rendering.

### Task 5: Accessibility, reduced motion, and regression verification

**Files:**
- Modify: `styles.css`
- Modify: `home-map-transition.js`
- Test: `tests/home-map-transition.test.js`

- [ ] **Step 1: Add reduced-motion behavior**

Under `prefers-reduced-motion: reduce`, remove large transforms and cloud movement, use an opacity-only transition, and navigate at `180ms`.

- [ ] **Step 2: Run focused and full tests**

Run:

```powershell
node --test tests/home-map-transition.test.js tests/level-map-layout.test.js tests/project-structure.test.js
node --test
```

Expected: all transition/map/structure tests pass. Record unrelated pre-existing failures from the full suite separately.

- [ ] **Step 3: Perform rendered timeline QA**

At `393 × 852`, verify and capture:

- initial home;
- approximately `200ms`: content moving radially away while IP stays fixed;
- approximately `500ms`: four cloud regions entering and obscuring the center;
- approximately `820ms`: URL is `level-map.html` and the frame matches `map-final-lanhu.png`.

Also verify double-click protection, keyboard Enter activation, console health, and the reduced-motion path.
