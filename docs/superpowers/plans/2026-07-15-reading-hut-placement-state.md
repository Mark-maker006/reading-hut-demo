# Reading Hut Placement State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place an unlocked furniture or decoration from the Reading Hut panel with one click, complete the placement after the inline demo video ends, persist the result, replace the matching ghost layer with the colored item, and remove the placed card from the panel.

**Architecture:** Add a classic-script `reading-hut-state.js` module that owns the versioned `localStorage` document and exposes pure normalization, purchase, and placement functions for Node tests and the browser. Keep item metadata in `reading-hut.html`, but add slot identifiers and room artwork classes. Run the existing MP4 in a full-screen overlay inside Reading Hut so the completion callback can update state and render the room without cross-page coordination.

**Tech Stack:** Native HTML/CSS/JavaScript, Node test runner, Playwright, browser `localStorage`.

---

### Task 1: Versioned state module

**Files:**
- Create: `reading-hut-state.js`
- Create: `tests/reading-hut-state.test.js`
- Modify: `reading-hut.html`

- [ ] **Step 1: Write the failing state tests**

Test that `createDefaultState()` returns version 1 and 30 stars, `purchaseItem()` atomically deducts stars and unlocks one item, `placeItem()` only places unlocked items, and `load()` recovers safely from malformed storage.

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/reading-hut-state.test.js`
Expected: FAIL because `reading-hut-state.js` does not exist.

- [ ] **Step 3: Implement the minimal module**

Expose the following UMD-compatible API:

```js
window.ReadingHutState = {
  STORAGE_KEY: 'reading-hut-state-v1',
  createDefaultState,
  load,
  save,
  purchaseItem,
  placeItem,
};
```

Use `{ version: 1, stars: 30, items: {} }`; each item entry stores `{ unlocked, placed }`. `purchaseItem` returns a new state only when affordable and not already unlocked. `placeItem` returns a new state only when the item is unlocked.

- [ ] **Step 4: Run focused tests and load the script before inline Reading Hut code**

Run: `node --test tests/reading-hut-state.test.js`
Expected: PASS.

### Task 2: Inline placement overlay and state flow

**Files:**
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`
- Modify: `tests/reading-hut-card-activation.test.js`
- Create: `tests/reading-hut-placement.test.js`

- [ ] **Step 1: Write failing interaction tests**

Cover: locked click opens the exchange dialog; confirm purchase persists `unlocked=true`; one click on the unlocked card opens `.placement-overlay`; the `ended` event persists `placed=true`, closes the overlay, removes the card, hides the matching ghost, and shows the colored room item; reload preserves all of those states.

- [ ] **Step 2: Run the focused interaction tests**

Run: `node --test tests/reading-hut-card-activation.test.js tests/reading-hut-placement.test.js`
Expected: FAIL because the current card navigates to `placement-video.html` and there is no inline overlay or placed render.

- [ ] **Step 3: Implement the overlay and one-click start**

Add a hidden `.placement-overlay` containing the existing MP4. Replace card anchors with buttons. For unlocked items, call `startPlacement(item)` on the first click. On video `ended`, call `ReadingHutState.placeItem`, save, re-render the room and current panel, and close/reset the overlay. On video error, complete the demo placement so a broken preview cannot trap the user.

- [ ] **Step 4: Make purchase state-backed**

Initialize item `unlocked` and `placed` flags from shared state. On confirm, call `purchaseItem`, persist the returned state, then keep the existing promotion, NEW tag, balance, and success bubble behavior.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/reading-hut-state.test.js tests/reading-hut-card-activation.test.js tests/reading-hut-placement.test.js`
Expected: PASS.

### Task 3: Slot layers and panel filtering

**Files:**
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`
- Modify: `tests/reading-hut-figma-panels.test.js`
- Modify: `tests/reading-hut-decoration-panel.test.js`

- [ ] **Step 1: Add slot mapping assertions**

Assert the seven item IDs map to `floor`, `rug`, `bookshelf`, `plant`, `doll`, `story-wall`, and `star-sticker`, and that every placement slot contains a ghost layer plus a colored item layer.

- [ ] **Step 2: Add and style colored room layers**

Keep the authoritative ghost slot geometry. Add `.placement-item` layers using the existing on-state assets, sized within the same slot coordinates. Toggle `.is-placed` on the matching slot to hide `.placement-ghost` children and show the colored layer.

- [ ] **Step 3: Filter placed cards**

Change `renderItems(category)` to exclude items whose shared state has `placed=true`. Preserve category order for all remaining cards.

- [ ] **Step 4: Run focused layout and interaction tests**

Run: `node --test tests/reading-hut-figma-panels.test.js tests/reading-hut-decoration-panel.test.js tests/reading-hut-placement.test.js`
Expected: PASS.

### Task 4: Remove obsolete placement page and verify

**Files:**
- Delete: `placement-video.html`
- Delete: `placement-video.css`
- Delete: `placement-video.js`
- Modify: `README.md`
- Modify: `tests/project-structure.test.js`

- [ ] **Step 1: Update project structure assertions and documentation**

Remove the three obsolete page files from expected active files. Document that placement animation now runs inside `reading-hut.html` and state is stored by `reading-hut-state.js`.

- [ ] **Step 2: Delete the obsolete files after confirming no runtime references**

Run: `rg -n "placement-video" -g "!*docs/superpowers/plans/*" .`
Expected: only obsolete files and tests being updated are found before deletion; none remain afterward.

- [ ] **Step 3: Run the complete suite**

Run: `node --test "tests/*.test.js"`
Expected: all tests pass with zero failures.

- [ ] **Step 4: Browser verification at 393 x 852**

Exercise: open Furniture → redeem Reading Rug → click it once → overlay video opens → dispatch/await video completion → rug ghost disappears, colored rug appears, card is absent → reload → balance, unlock, placement, and card absence persist. Repeat the placement-completion assertion for one Decoration card and confirm no relevant console errors.
