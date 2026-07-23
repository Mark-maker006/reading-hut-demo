# Home Map Transition v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fast 820ms transition with a clear 1500ms sequence: slow radial card exit, hero-to-base-map crossfade, four-edge cloud entry, final-map handoff, then navigation.

**Architecture:** Extend the existing deterministic transition controller with a `map-revealing` state and revised timing contract. The fixed homepage transition stage will contain separate base-map, final-map, and cloud layers so each visual phase can be controlled independently while preserving the existing navigation, bfcache, fallback, and reduced-motion behavior.

**Tech Stack:** Static HTML/CSS, browser JavaScript, Node test runner, Playwright/browser visual QA.

---

### Task 1: Acquire the Lanhu base-map transition asset

**Files:**
- Create: `assets/map-transition-base-lanhu.png`

- [ ] **Step 1: Locate the exact Lanhu item**

Open the existing Lanhu project tree and select the item whose label is exactly `地图-切图`, matching the user-provided screenshot. Record its real node ID; do not substitute `地图-终版` or another same-project asset.

- [ ] **Step 2: Download the original PNG**

Read the detail page's `img.big-img.show-big` source and save the original bytes without recompression as:

```text
assets/map-transition-base-lanhu.png
```

- [ ] **Step 3: Verify source integrity**

Run a PNG header, dimensions, alpha/mode, and SHA-256 check. Confirm it is the tall no-cloud map shown in the screenshot and record its dimensions for CSS `object-fit: fill` mapping.

### Task 2: Change the controller timeline with TDD

**Files:**
- Modify: `tests/home-map-transition.test.js`
- Modify: `home-map-transition.js`

- [ ] **Step 1: Write failing timing-contract tests**

Update the timing expectation to:

```js
assert.deepEqual(TIMING, {
  scatterDuration: 650,
  mapRevealStart: 520,
  cloudStart: 850,
  settleStart: 1350,
  navigateAt: 1500,
  reducedNavigateAt: 180,
});
```

Add boundary assertions that state remains `scattering` at 519ms, becomes `map-revealing` at 520ms, remains there at 849ms, becomes `cloud-covering` at 850ms, becomes `settling` at 1350ms, and navigates once at 1500ms.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/home-map-transition.test.js
```

Expected: FAIL because the existing contract still uses 400/220/700/820ms and has no `map-revealing` state.

- [ ] **Step 3: Implement the minimal controller change**

Change the frozen timing object and schedule states in this order:

```js
schedule(function () {
  changeState('map-revealing');
}, TIMING.mapRevealStart);
schedule(function () {
  changeState('cloud-covering');
}, TIMING.cloudStart);
schedule(function () {
  changeState('settling');
}, TIMING.settleStart);
schedule(navigateOnce, TIMING.navigateAt);
```

Keep reduced motion as a single 180ms navigation timer.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command and expect all transition tests to pass.

### Task 3: Separate the base map and final map layers

**Files:**
- Modify: `index.html`
- Modify: `tests/home-map-transition.test.js`

- [ ] **Step 1: Write a failing DOM-layer test**

Assert the transition stage contains the layers in this exact order:

```html
<img class="transition-map-base" src="./assets/map-transition-base-lanhu.png" alt="" />
<img class="transition-map-preview" src="./assets/map-final-lanhu.png" alt="" />
```

The four existing `transition-cloud-piece` elements must remain after both map layers.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/home-map-transition.test.js
```

Expected: FAIL because `transition-map-base` does not exist.

- [ ] **Step 3: Add the base-map element**

Insert the base-map image immediately before the final-map image. Do not change the IP link, five scatter markers, map destination, or cloud asset references.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command and expect the DOM-layer test to pass.

### Task 4: Map the new state to DOM classes with TDD

**Files:**
- Modify: `tests/home-map-transition.test.js`
- Modify: `home-map-transition.js`

- [ ] **Step 1: Write a failing bootstrap-state test**

At `TIMING.mapRevealStart`, assert:

```js
assert.equal(surface.stage.classList.contains('is-map-revealing'), true);
assert.equal(surface.html.classList.contains('home-map-revealing'), true);
assert.equal(surface.body.classList.contains('home-map-revealing'), true);
```

Also assert `removeTransitionClasses()` and bfcache restoration remove all three classes.

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the existing bootstrap only maps scattering, cloud-covering, settling, and navigating.

- [ ] **Step 3: Implement state/class mapping**

Add:

```js
} else if (state === 'map-revealing') {
  if (documentElement) documentElement.classList.add('home-map-revealing');
  if (body) body.classList.add('home-map-revealing');
  stage.classList.add('is-map-revealing');
```

Update cleanup to remove `home-map-revealing` and `is-map-revealing`. Leave repeat-start, storage, preloading, page lifecycle, and disposal behavior unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/home-map-transition.test.js
```

Expected: all focused tests pass.

### Task 5: Implement the slower visual sequence

**Files:**
- Modify: `styles.css`
- Test: `tests/home-map-transition.test.js`

- [ ] **Step 1: Write failing CSS-contract tests**

Lock these behaviors:

```css
[data-home-transition-piece] {
  transition:
    transform 650ms cubic-bezier(0.65, 0, 0.35, 1),
    opacity 320ms ease 300ms,
    filter 320ms ease 300ms;
}

.home-map-revealing .hero-art,
.home-map-revealing .hero-mask,
.home-map-revealing .hero-ip-art {
  opacity: 0;
}

.home-map-transition.is-map-revealing .transition-map-base {
  opacity: 1;
}
```

Also assert the base-map crossfade duration is 380ms, cloud movement duration is 500ms, and the final-map layer remains transparent until `is-settling`.

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the current CSS uses 400ms scatter, shows the final map during `clouds-in`, and lacks a base-map layer.

- [ ] **Step 3: Implement the CSS layers and timing**

Apply these z-index roles:

```css
.transition-map-base { z-index: 0; }
.transition-map-preview { z-index: 1; }
.transition-cloud-piece { z-index: 2; }
```

Keep both maps `object-fit: fill`. Fade the base map from 0 to 1 only under `is-map-revealing`; fade the final map from 0 to 1 only under `is-settling`/`is-navigating`; fade the base map back to 0 during settling. Move clouds to zero over 500ms only after `clouds-in`, then fade them out during settling.

- [ ] **Step 4: Preserve reduced motion**

Under `prefers-reduced-motion: reduce`, keep all large transforms disabled, hide cloud pieces, and use only the existing 180ms opacity path. The base/final map layers must not introduce a second long animation.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/home-map-transition.test.js
```

Expected: all focused tests pass.

### Task 6: Regression and rendered timeline verification

**Files:**
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `home-map-transition.js`
- Verify: `level-map.html`
- Verify: `level-map.css`

- [ ] **Step 1: Run focused regression tests**

```powershell
node --test tests/home-map-transition.test.js tests/level-map-layout.test.js tests/project-structure.test.js
```

Expected: all transition, map, and structure tests pass.

- [ ] **Step 2: Run the full suite**

```powershell
node --test
```

Record the seven known Reading Hut 30/500 failures separately; do not modify Reading Hut files as part of this plan.

- [ ] **Step 3: Verify the 393×852 timeline**

Capture evidence at:

- approximately 300ms: cards remain recognizable and are visibly moving outward;
- approximately 700ms: hero is fading while the no-cloud map is fading in;
- approximately 1050ms: four cloud regions are entering over the visible base map;
- approximately 1450ms: final map is nearly opaque and animated clouds are nearly gone;
- approximately 1500ms: URL is `level-map.html` and hotspots are usable.

- [ ] **Step 4: Verify interaction and accessibility paths**

Check double-click protection, Enter activation, Back/bfcache recovery, no relevant console warnings/errors, resource-failure fog fallback, and `prefers-reduced-motion: reduce` navigation at about 180ms.
