# Lanhu Final Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current layered level map visuals with the approved Lanhu `375 × 812` final composite while preserving the existing home, reading-hut, and achievement navigation.

**Architecture:** Render one local composite PNG as the complete visual surface. Keep navigation as semantic transparent anchors positioned with percentages relative to the source image so they scale with the `393 × 852` preview.

**Tech Stack:** Static HTML, CSS, local PNG assets, Node test runner, Browser visual QA.

---

### Task 1: Add the approved map artwork

**Files:**
- Create: `assets/map-final-lanhu.png`

- [ ] **Step 1: Copy the downloaded Lanhu source into the runtime assets**

Copy `FigmaCoverb48285733844954c843ea6bd7a3c556e.png` without recompression.

- [ ] **Step 2: Verify the source dimensions**

Run a PNG dimension check and expect `375 × 812`.

### Task 2: Replace the map visual structure while preserving navigation

**Files:**
- Modify: `level-map.html`
- Modify: `level-map.css`

- [ ] **Step 1: Replace the layered map markup**

Render `assets/map-final-lanhu.png` as the only visible artwork and retain anchors with these destinations:

```html
<a href="./index.html" aria-label="返回首页"></a>
<a href="./reading-hut.html" aria-label="进入阅读小屋"></a>
<a href="./achievement.html" aria-label="进入成就页面"></a>
```

- [ ] **Step 2: Map the three transparent hotspots to the composite**

Use percentage coordinates derived from the `375 × 812` source image. Keep the page fixed to the phone viewport and preserve focus-visible outlines for keyboard users.

### Task 3: Update visual regression assertions

**Files:**
- Modify: `tests/level-map-layout.test.js`

- [ ] **Step 1: Replace obsolete layered-node assertions**

Assert the new composite source dimensions, the three navigation destinations, percentage hotspot positioning, fixed viewport behavior, and local-only asset references.

- [ ] **Step 2: Run the focused tests**

Run:

```powershell
node --test tests/level-map-layout.test.js tests/project-structure.test.js
```

Expected: all focused tests pass.

### Task 4: Render and interaction verification

**Files:**
- Verify: `level-map.html`
- Verify: `level-map.css`

- [ ] **Step 1: Verify at the native design viewport**

Open `/level-map.html` at `375 × 812` and compare against the downloaded Lanhu artwork.

- [ ] **Step 2: Verify at the project viewport**

Open `/level-map.html` at `393 × 852`; confirm no clipping, distortion, missing artwork, or console errors.

- [ ] **Step 3: Exercise navigation**

Click the back, reading-hut, and achievement hotspots and confirm each URL matches the retained interaction contract.
