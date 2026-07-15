# Native Placement Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-screen placement MP4 with a reusable 2.2-second native flight, trail, smoke, sparkle, and settle animation inside Reading Hut.

**Architecture:** Put reusable geometry and DOM animation orchestration in `reading-hut-placement-motion.js`. Reading Hut passes the clicked thumbnail and mapped placement slot to the animator, then commits the existing placement state only after the animation promise resolves.

**Tech Stack:** Native JavaScript Web Animations API, SVG paths, CSS keyframes, Node test runner, Playwright.

---

### Task 1: Motion geometry module

**Files:**
- Create: `reading-hut-placement-motion.js`
- Create: `tests/reading-hut-placement-motion.test.js`

- [ ] Write tests for a four-keyframe curved flight, an SVG cubic path, and nine deterministic smoke puffs.
- [ ] Run `node --test tests/reading-hut-placement-motion.test.js` and verify it fails because the module is missing.
- [ ] Implement `createFlightGeometry`, `SMOKE_PUFFS`, and `playPlacementMotion` as a UMD-compatible module.
- [ ] Run the focused test and verify it passes.

### Task 2: Reading Hut integration

**Files:**
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`
- Modify: `tests/reading-hut-card-activation.test.js`
- Modify: `tests/reading-hut-placement.test.js`

- [ ] Change interaction tests to require `.placement-motion-layer`, `.placement-flyer`, the SVG trail, smoke puffs, and completion without a video event.
- [ ] Run focused tests and verify they fail against the MP4 implementation.
- [ ] Replace the video markup with transparent trail/smoke containers and load `reading-hut-placement-motion.js`.
- [ ] Call `playPlacementMotion` from `startPlacement`, preview the target at impact, and invoke the existing placement state commit after the promise resolves.
- [ ] Add CSS for the transparent blocking layer, trail glow, smoke expansion, sparkles, target settle, and reduced motion.
- [ ] Run focused tests and verify they pass.

### Task 3: Remove video dependency and verify

**Files:**
- Modify: `tests/project-structure.test.js`
- Modify: `README.md`
- Delete: `assets/furniture-flying-animation.mp4`

- [ ] Add a failing structure assertion that the MP4 is absent and the motion module is an active source.
- [ ] Remove the MP4 and update documentation.
- [ ] Run `node --test "tests/*.test.js"` and verify zero failures.
- [ ] Verify at 393×852: furniture and decoration fly from their clicked cards to mapped slots, no white frame appears, state persists after reload, and no relevant console errors occur.
