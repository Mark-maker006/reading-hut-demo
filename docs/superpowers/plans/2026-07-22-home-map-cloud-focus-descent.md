# Home Map Cloud Focus Descent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-piece cloud transition with a single cloud-and-focus composition while the bare map descends from an enlarged aerial view, the map UI arrives early, and the unlocked Reading Hut lands before the final map takes over without a flash.

**Architecture:** Keep the existing transition controller and handoff marker. Expand the transition stage into six explicit visual layers—bare map, cropped top UI, unlocked house, CSS focus veil, one cloud overlay, and final map—and drive them with the existing state classes plus CSS delays/keyframes. Preserve the current home scatter, 1000ms hero fade, map hotspots, and no-second-reveal map entry.

**Tech Stack:** Static HTML, CSS transitions/keyframes, vanilla JavaScript, Node.js built-in test runner.

---

### Task 1: Lock the new timeline and layer contract

**Files:**
- Modify: `tests/home-map-transition.test.js`

- [ ] **Step 1: Update the timing test**

Assert `mapRevealStart: 260`, `cloudStart: 520`, `settleStart: 1250`, and `navigateAt: 1500` while preserving the existing scatter, hero fade, and reduced-motion values.

- [ ] **Step 2: Replace the old four-cloud markup assertion**

Assert this exact direct layer order: `.transition-map-base`, `.transition-map-ui` using `map-final-lanhu.png`, `.transition-map-house` using `map-house.png`, `.transition-focus-mask`, `.transition-map-cloud` using `map-cloud-overlay.png`, and `.transition-map-preview` using `map-final-lanhu.png`. Assert there is exactly one cloud layer and no directional cloud-piece classes.

- [ ] **Step 3: Add CSS behavior assertions**

Assert the base uses `scale(1.16)` and settles through `scale(0.985)` to `scale(1)`; the top UI has a short 200ms early entrance; the house has a delayed 300ms landing; the focus mask and single cloud enter together for 660ms; the final image takes over at settling; and reduced motion hides every temporary layer and shows only the final image.

- [ ] **Step 4: Run the focused test and confirm RED**

Run: `node --test tests/home-map-transition.test.js`

Expected: FAIL because the production markup still has four clipped cloud pieces and the controller still starts map/cloud at 300ms and settles at 1350ms.

### Task 2: Implement the state timeline and six-layer transition stage

**Files:**
- Modify: `home-map-transition.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Update controller timing constants**

Set `mapRevealStart` to 260, `cloudStart` to 520, and `settleStart` to 1250. Keep navigation at 1500ms.

- [ ] **Step 2: Replace transition markup**

Render one base map image, one clipped top-UI layer reusing the final image, one `map-house.png`, one semantic-free focus-mask element, one cloud overlay image, and one final-map image in that order.

- [ ] **Step 3: Implement the CSS choreography**

Use the fixed 393×852 stage. Reveal the UI at 150ms over 200ms; animate the base from `scale(1.16)` to `scale(0.985)` and then `scale(1)` over 790ms from the 260ms reveal; land the house from `translateY(-24px) scale(1.08)` over 300ms beginning at 420ms; move the focus mask and the single cloud from `translateY(34%) scale(1.06)` to rest over 660ms beginning at 520ms; contract the mask's radial clear window around the Reading Hut during the latter half of that interval; crossfade the final map at 1250ms and leave it fully opaque through navigation.

- [ ] **Step 4: Update preload expectations**

Keep source de-duplication: the six DOM layers must preload exactly four unique files—base, final/UI, house, and cloud.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `node --test tests/home-map-transition.test.js`

Expected: all tests in the file pass.

### Task 3: Rendered and regression verification

**Files:**
- Verify: `index.html`
- Verify: `level-map.html`
- Verify: `styles.css`
- Verify: `level-map.css`

- [ ] **Step 1: Verify the transition at 393×852**

Open the home page, click the IP, and inspect the sequence: UI arrives first, the bare map descends from large to settled, the house lands, one seamless cloud layer and white veil move in together, the veil focuses the unlocked house, and the final map takes over without a flash before navigation.

- [ ] **Step 2: Verify handoff and interaction**

Confirm the final frame immediately before navigation matches the initial frame of `level-map.html`, and that back, Reading Hut, and achievement hotspots retain their targets.

- [ ] **Step 3: Run focused and full regressions**

Run: `node --test tests/home-map-transition.test.js tests/level-map-layout.test.js`

Then run: `node --test tests/*.test.js`

Expected: the transition/map tests pass. If the existing Reading Hut 30/500 balance assertions remain red, report those separately as pre-existing and do not modify Reading Hut files.

