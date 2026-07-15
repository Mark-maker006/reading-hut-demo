# Reading Hut Integrated Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone star store with unified furniture and decoration panels that support browsing, one-time redemption, placement, insufficient-balance guidance, and synchronized collection progress.

**Architecture:** Keep the project dependency-free and static. Put catalog and wallet rules in a browser/Node-compatible state module, keep DOM behavior in page controllers, persist the single user state in `localStorage`, and derive affordability and collection totals instead of storing duplicates.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Node.js built-in `node:test`, browser `localStorage`.

---

## File map

- Create `package.json`: declares the built-in Node test command.
- Create `reading-hut-state.js`: owns item definitions, wallet state, redemption rules, persistence helpers, and derived selectors.
- Create `reading-hut.js`: renders the room item panels and dialogs, wires navigation and placement behavior.
- Modify `reading-hut.html`: replaces the four-button navigation and static bag markup with semantic containers used by the controller.
- Modify `reading-hut.css`: styles the three-button navigation, unified item panel, card states, dialogs, and feedback.
- Modify `index.html`: adds a stable anchor to the existing daily reading plan.
- Modify `illustration-book.html`: replaces screenshot-only slides with live furniture and decoration collection panels.
- Modify `illustration-book.css`: preserves the illustrated book frame while styling live collection cards and progress.
- Modify `illustration-book.js`: keeps swipe navigation and renders live collection state from the shared state module.
- Create `tests/reading-hut-state.test.js`: verifies wallet, redemption, ownership, affordability, persistence normalization, and collection totals.
- Delete `store.html` and `store.css`: removes the obsolete standalone store surface.

## Task 1: Add the state model and test harness

**Files:**
- Create: `package.json`
- Create: `reading-hut-state.js`
- Create: `tests/reading-hut-state.test.js`

- [ ] **Step 1: Add the Node test command**

Create `package.json`:

```json
{
  "name": "figma-home-preview",
  "private": true,
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

- [ ] **Step 2: Write failing state tests**

Create `tests/reading-hut-state.test.js` with tests that import `../reading-hut-state.js` and assert:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const HutState = require("../reading-hut-state.js");

test("default state starts with 24 stars and one owned bookshelf", () => {
  const state = HutState.createInitialState();
  assert.equal(state.starBalance, 24);
  assert.equal(state.items.bookshelf.owned, true);
  assert.equal(HutState.getCollectionTotals(state).owned, 1);
});

test("redeeming an affordable item subtracts stars once", () => {
  const state = HutState.createInitialState();
  const result = HutState.redeem(state, "table-lamp");
  assert.equal(result.ok, true);
  assert.equal(result.state.starBalance, 4);
  assert.equal(result.state.items["table-lamp"].owned, true);
  assert.equal(HutState.redeem(result.state, "table-lamp").reason, "already-owned");
});

test("insufficient balance reports the exact shortage without mutation", () => {
  const state = HutState.createInitialState();
  const result = HutState.redeem(state, "reading-chair");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "insufficient-stars");
  assert.equal(result.shortage, 6);
  assert.deepEqual(result.state, state);
});

test("affordability and totals are derived", () => {
  const state = HutState.createInitialState();
  assert.equal(HutState.getItemView(state, "table-lamp").status, "affordable");
  assert.equal(HutState.getItemView(state, "reading-chair").status, "unaffordable");
  assert.deepEqual(HutState.getCollectionTotals(state), { owned: 1, total: 12 });
});

test("placing is separate from redeeming", () => {
  const redeemed = HutState.redeem(HutState.createInitialState(), "table-lamp").state;
  assert.equal(redeemed.items["table-lamp"].placed, false);
  const placed = HutState.place(redeemed, "table-lamp");
  assert.equal(placed.items["table-lamp"].placed, true);
});

test("saved state normalization ignores unknown items and restores missing items", () => {
  const normalized = HutState.normalizeState({
    starBalance: 8,
    items: { bookshelf: { owned: true, placed: false }, unknown: { owned: true } }
  });
  assert.equal(normalized.starBalance, 8);
  assert.equal(normalized.items.unknown, undefined);
  assert.equal(normalized.items["table-lamp"].owned, false);
});
```

- [ ] **Step 3: Run tests and confirm the expected failure**

Run: `npm test`

Expected: FAIL because `reading-hut-state.js` does not exist.

- [ ] **Step 4: Implement the minimal shared state module**

Create `reading-hut-state.js` as a UMD-style module. Define exactly 12 unique items split between furniture and decoration. Use these stable IDs and prices:

```js
const ITEMS = [
  { id: "bookshelf", category: "furniture", name: "小书架", price: 30, image: "./assets/bag-bookshelf.png" },
  { id: "table-lamp", category: "furniture", name: "小台灯", price: 20, icon: "💡" },
  { id: "reading-chair", category: "furniture", name: "阅读椅", price: 30, icon: "🛋️" },
  { id: "study-desk", category: "furniture", name: "小书桌", price: 18, icon: "🪑" },
  { id: "storage-cabinet", category: "furniture", name: "收纳柜", price: 25, icon: "🗄️" },
  { id: "book-stack", category: "furniture", name: "书本堆", price: 10, icon: "📚" },
  { id: "leaf-painting", category: "decoration", name: "绿植挂画", price: 18, icon: "🖼️" },
  { id: "flower-rug", category: "decoration", name: "小花地毯", price: 40, icon: "🌼" },
  { id: "hanging-plant", category: "decoration", name: "垂吊绿植", price: 15, icon: "🪴" },
  { id: "star-lamp", category: "decoration", name: "星星吊灯", price: 25, icon: "⭐" },
  { id: "green-curtain", category: "decoration", name: "小清新窗帘", price: 12, icon: "🪟" },
  { id: "teddy-bear", category: "decoration", name: "可爱玩偶", price: 10, icon: "🧸" }
];
```

Export `ITEMS`, `createInitialState`, `normalizeState`, `getItemView`, `getItemsByCategory`, `getCollectionTotals`, `redeem`, `place`, `load`, and `save`. `redeem` must return `{ ok, reason, shortage, state }`, clone before mutation, reject unknown and owned items, and never set `placed` to true. `load` and `save` use the key `reading-hut-state-v1` only when `localStorage` is available.

- [ ] **Step 5: Run the state tests**

Run: `npm test`

Expected: 6 tests PASS.

## Task 2: Replace the room navigation and panel markup

**Files:**
- Modify: `reading-hut.html`
- Delete: `store.html`
- Delete: `store.css`

- [ ] **Step 1: Replace the static star image with a live balance control**

Use this structure inside `.room-topbar`:

```html
<div class="star-balance" aria-label="当前有24颗星星">
  <span aria-hidden="true">⭐</span>
  <strong data-star-balance>24</strong>
</div>
```

- [ ] **Step 2: Reduce the bottom navigation to three entries**

Keep the existing furniture, decoration, and catalog artwork. Remove the store anchor completely. Set the visible labels and accessible names to `家具`, `装饰`, and `图鉴`. Give the two buttons `data-open-category="furniture"` and `data-open-category="decoration"`.

- [ ] **Step 3: Replace the bag-specific panel with a neutral item panel**

Use one reusable panel:

```html
<div class="item-overlay" aria-hidden="true"></div>
<section class="item-panel" aria-hidden="true" aria-labelledby="item-panel-title">
  <header class="item-panel-header">
    <h2 id="item-panel-title">家具</h2>
    <span class="panel-balance">⭐ <strong data-panel-balance>24</strong></span>
    <button class="item-panel-close" type="button" aria-label="关闭">×</button>
  </header>
  <div class="item-grid" data-item-grid></div>
</section>
<div class="dialog-overlay" aria-hidden="true"></div>
<section class="redeem-dialog" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="redeem-title">
  <div data-dialog-content></div>
</section>
<div class="toast" role="status" aria-live="polite" aria-hidden="true"></div>
```

- [ ] **Step 4: Move inline JavaScript to external controllers**

Remove the existing inline IIFE. Before `</body>`, load:

```html
<script src="./reading-hut-state.js"></script>
<script src="./reading-hut.js"></script>
```

Preserve the existing placement hotspot and mascot tip behavior in `reading-hut.js`.

- [ ] **Step 5: Delete the standalone store files**

Delete `store.html` and `store.css` after confirming no remaining link points to them.

## Task 3: Style the integrated panels and dialogs

**Files:**
- Modify: `reading-hut.css`

- [ ] **Step 1: Convert four-button spacing to three balanced actions**

Make `.room-bottom-actions` use `justify-content: space-around`; remove `.room-action-store`; give all three controls a minimum 44 × 44 px interactive area and preserve visible focus outlines.

- [ ] **Step 2: Replace `.bag-*` rules with `.item-*` rules**

The panel remains a bottom sheet over the room but grows to approximately `374px × 300px`, has a parchment background, a fixed header, and a horizontally scrollable or wrapped 3-column grid. The overlay uses the existing 400 ms transition. Ensure labels remain at least 12 px and controls are not color-only.

- [ ] **Step 3: Add explicit card state selectors**

Implement these selectors and visible text:

```css
.item-card[data-status="affordable"] .item-price { background:#f6b91d; color:#5f3b00; }
.item-card[data-status="unaffordable"] .item-price { background:#d8d1c2; color:#665f54; }
.item-card[data-status="owned"] .item-state,
.item-card[data-status="placed"] .item-state { background:#79a536; color:#fff; }
.item-card[data-status="placed"] { border:3px solid #79a536; }
```

Cards must render `⭐ 数额`, `已拥有`, or `使用中`, never more than one of them.

- [ ] **Step 4: Add dialog, toast, disabled, and reduced-motion styles**

Give the dialog two buttons with at least 44 px height. Disabled confirm buttons must reduce contrast and ignore pointer events. Add `@media (prefers-reduced-motion: reduce)` to disable sheet, toast, and reward transitions.

## Task 4: Implement room interactions and redemption

**Files:**
- Create: `reading-hut.js`
- Modify: `index.html`

- [ ] **Step 1: Render the current category from shared state**

On startup, call `HutState.load()`. `renderCategory(category)` reads `HutState.getItemsByCategory(state, category)`, creates buttons with `data-item-id` and `data-status`, and updates both balance elements and accessible labels.

- [ ] **Step 2: Implement open, close, and focus behavior**

Opening a category sets the title to `家具` or `装饰`, renders the grid, shows the panel/overlay, and moves focus to the close button. Closing returns focus to the button that opened the panel. Escape closes the topmost dialog or panel.

- [ ] **Step 3: Implement item click routing**

- `owned`: treat the second explicit click as the placement action; call `HutState.place`, save, re-render the card as `使用中`, and announce `已摆放到房间`.
- `placed`: keep the panel open and announce `已在房间中` without changing state.
- `affordable`: open a confirmation dialog showing current balance and balance after redemption.
- `unaffordable`: open the shortage dialog showing the exact missing stars.

- [ ] **Step 4: Implement safe confirmation**

Disable `确认兑换` on first click, call `HutState.redeem`, save only on success, then re-render the card, top balance, and panel balance. Display `兑换成功，已添加到家具` or `兑换成功，已添加到装饰`; mark the card `NEW` for one render cycle without setting `placed`.

- [ ] **Step 5: Implement insufficient-balance navigation**

The shortage dialog has `暂不兑换` and an anchor labeled `去完成计划` pointing to `./index.html#today-reading-plan`. Add `id="today-reading-plan"` to the existing daily plan section in `index.html`.

- [ ] **Step 6: Preserve the existing mascot guidance**

Port the placement hotspot, room tip, and study tip listeners from the removed inline script without changing their visible behavior.

## Task 5: Rebuild the illustration book as a live collection view

**Files:**
- Modify: `illustration-book.html`
- Modify: `illustration-book.css`
- Modify: `illustration-book.js`

- [ ] **Step 1: Replace screenshot-only slides with semantic collection markup**

Each slide contains a shared header, total progress, category progress, a 3-column card grid, and the existing furniture/decoration tab buttons. Do not render prices, store buttons, yellow collection stars, or lock icons.

- [ ] **Step 2: Render collection cards from shared state**

Load `reading-hut-state.js` before `illustration-book.js`. For each category, use the same item definitions. Owned items render full-color art/icon plus a green `✓`; unowned items use `filter: grayscale(1)`, reduced opacity, and the text `未收集`.

- [ ] **Step 3: Derive both progress counters**

Render total progress from `getCollectionTotals(state)` and category progress from the category array. Never persist separate counters.

- [ ] **Step 4: Preserve swipe navigation and add tab clicks**

Keep the existing pointer swipe logic. Furniture and decoration tab buttons call `setPage(0)` and `setPage(1)`. Clicking an unowned card opens a small read-only hint: `前往小屋的家具中兑换` or `前往小屋的装饰中兑换`.

- [ ] **Step 5: Add visual regression checks**

Start `python -m http.server 4173`, inspect `reading-hut.html` and `illustration-book.html` at 393 × 852, and verify no card text overlaps, all three bottom actions fit, and the book grid remains within the illustrated page boundary.

## Task 6: Add controller-level state tests and complete verification

**Files:**
- Modify: `tests/reading-hut-state.test.js`

- [ ] **Step 1: Add failure-path tests**

Append these exact cases:

```js
test("unknown and already-owned redemption attempts do not mutate state", () => {
  const state = HutState.createInitialState();
  const unknown = HutState.redeem(state, "missing-item");
  const owned = HutState.redeem(state, "bookshelf");
  assert.equal(unknown.reason, "unknown-item");
  assert.equal(owned.reason, "already-owned");
  assert.deepEqual(unknown.state, state);
  assert.deepEqual(owned.state, state);
});

test("an unowned item cannot be placed", () => {
  const state = HutState.createInitialState();
  const result = HutState.place(state, "table-lamp");
  assert.deepEqual(result, state);
});

test("normalization clamps invalid balances to zero", () => {
  const normalized = HutState.normalizeState({ starBalance: -9, items: {} });
  assert.equal(normalized.starBalance, 0);
});
```

- [ ] **Step 2: Run automated tests**

Run: `npm test`

Expected: all state tests PASS with zero failures.

- [ ] **Step 3: Run static link and syntax checks**

Run:

```powershell
node --check reading-hut-state.js
node --check reading-hut.js
node --check illustration-book.js
rg -n "store.html|room-action-store|家具背包|装饰背包|限购|data-status=\"locked\"" reading-hut.html reading-hut.css reading-hut.js illustration-book.html illustration-book.css illustration-book.js
```

Expected: all `node --check` commands exit 0; `rg` returns no obsolete store, bag, limited-purchase, or locked-state references.

- [ ] **Step 4: Manually verify the primary flow**

At 393 × 852:

1. Open furniture and confirm the balance is 24.
2. Redeem the 20-star table lamp and confirm the balance becomes 4.
3. Confirm the lamp is `已拥有` and is not automatically placed.
4. Click the owned lamp a second time and confirm its state becomes `使用中`.
5. Open the catalog and confirm total progress changes from 1/12 to 2/12.
6. Reopen the room, attempt the 30-star reading chair, confirm `还差 26 颗星`, and follow `去完成计划` to `#today-reading-plan`.
7. Refresh and confirm balance, ownership, and placement state persist.

- [ ] **Step 5: Run the two-cohort usability protocol**

Test separately with小学 1–3 年级 and 4–6 年级 participants. Ask each child to identify the balance, redeem the lamp, find and place it, try the unaffordable chair, explain how to earn more stars, and identify collected items in the catalog. Record any case where the child mistakes a collection mark for a price, treats a gray item as permanently locked, expects automatic placement, or cannot find the daily plan path.

- [ ] **Step 6: Record the no-Git limitation**

This directory is not currently a Git repository, so commit steps cannot run. If it is later placed inside a repository, commit the tasks separately with messages `feat: add hut redemption state`, `feat: integrate item redemption into room`, and `feat: sync live illustration book`.
