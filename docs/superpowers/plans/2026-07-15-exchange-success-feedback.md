# Exchange Success Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a five-second exchange-success bubble, independently timed NEW tags, latest-redeemed-card promotion, and the exact Figma dialog scrim to the Reading Hut exchange flow.

**Architecture:** Keep the existing vanilla HTML/CSS/JavaScript page structure. Put reusable ordering logic in `reading-hut-exchange.js`, keep DOM/timer orchestration in the existing page controller, and use one timer per redeemed item plus one replaceable timer for the latest success bubble. Re-render only the active category after a successful exchange so card order, NEW state, and scroll position stay synchronized.

**Tech Stack:** Vanilla HTML, CSS, JavaScript, Node.js built-in test runner.

---

### Task 1: Add failing tests for ordering and visual contract

**Files:**
- Create: `tests/reading-hut-exchange-success-feedback.test.js`
- Modify: `reading-hut-exchange.js`

- [ ] **Step 1: Write the failing ordering test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { promoteItemById } = require('../reading-hut-exchange.js');

test('promoteItemById moves only the redeemed item to the front', () => {
  const items = [{ id: 'rug' }, { id: 'floor' }, { id: 'shelf' }];
  assert.deepEqual(promoteItemById(items, 'shelf').map((item) => item.id), [
    'shelf', 'rug', 'floor',
  ]);
  assert.deepEqual(items.map((item) => item.id), ['rug', 'floor', 'shelf']);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/reading-hut-exchange-success-feedback.test.js`

Expected: FAIL because `promoteItemById` is not implemented.

- [ ] **Step 3: Implement the minimal pure ordering helper**

Add to `reading-hut-exchange.js`:

```js
function promoteItemById(items, itemId) {
  const index = items.findIndex(function (item) { return item.id === itemId; });
  if (index <= 0) return items.slice();
  return [items[index]].concat(items.slice(0, index), items.slice(index + 1));
}
```

Export it alongside `getExchangeOutcome`.

- [ ] **Step 4: Run the helper test and commit**

Run: `node --test tests/reading-hut-exchange-success-feedback.test.js`

Expected: the ordering test passes.

Commit:

```bash
git add reading-hut-exchange.js tests/reading-hut-exchange-success-feedback.test.js
git commit -m "test: define exchange success feedback behavior"
```

### Task 2: Add the success bubble and exact Figma scrim

**Files:**
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`
- Test: `tests/reading-hut-exchange-success-feedback.test.js`

- [ ] **Step 1: Add and run failing visual-contract tests**

Read `reading-hut.html` and `reading-hut.css`, then assert:

```js
assert.match(html, /class="exchange-success-tip"/);
assert.match(css, /\.exchange-overlay\s*\{[^}]*background:\s*rgba\(51, 51, 51, 0\.8\);/s);
assert.match(css, /\.bag-item-new\s*\{[^}]*top:\s*0;[^}]*left:\s*0;[^}]*width:\s*29\.523px;[^}]*height:\s*22\.605px;/s);
```

Run: `node --test tests/reading-hut-exchange-success-feedback.test.js`

Expected: FAIL because `.exchange-success-tip` and the Figma scrim are not implemented.

- [ ] **Step 2: Add the dedicated success-bubble element**

Place it beside the existing room/study tips:

```html
<div class="exchange-success-tip" aria-label="兑换成功提示" aria-hidden="true"></div>
```

- [ ] **Step 3: Reuse the current yellow bubble visual in the Panel-open layout**

Add CSS that matches the existing tip border, fill, radius, shadow, typography, and arrow. Position it next to the Panel-state mascot, keep it hidden by default, and reveal it with `.is-visible` without changing mascot geometry.

- [ ] **Step 4: Apply the Figma scrim**

Change the existing overlay rule from `background: transparent` to:

```css
background: rgba(51, 51, 51, 0.8);
```

Keep `.exchange-dialog` above the scrim through the existing overlay stacking context.

- [ ] **Step 5: Run the test and verify the visual contract is GREEN**

Run: `node --test tests/reading-hut-exchange-success-feedback.test.js`

Expected: success-tip markup, Figma scrim, and existing NEW-tag geometry assertions pass.

- [ ] **Step 6: Commit**

```bash
git add reading-hut.html reading-hut.css tests/reading-hut-exchange-success-feedback.test.js
git commit -m "feat: add exchange success bubble and dialog scrim"
```

### Task 3: Implement five-second NEW tags, success bubble lifecycle, and card promotion

**Files:**
- Modify: `reading-hut.html`
- Test: `tests/reading-hut-exchange-success-feedback.test.js`

- [ ] **Step 1: Add and run failing interaction-contract tests**

Add assertions for the required state transitions:

```js
assert.match(html, /const NEW_TAG_DURATION_MS = 5000;/);
assert.match(html, /item\.newUntil = Date\.now\(\) \+ NEW_TAG_DURATION_MS;/);
assert.match(html, /ITEMS\[category\] = promoteItemById\(ITEMS\[category\], item\.id\);/);
assert.match(html, /itemList\.scrollLeft = 0;/);
assert.match(html, /showExchangeSuccessTip\(category, item\.id\);/);
assert.match(html, /if \(card\.dataset\.itemId === latestExchangeItemId\) hideExchangeSuccessTip\(\);/);
```

Run: `node --test tests/reading-hut-exchange-success-feedback.test.js`

Expected: FAIL because the five-second lifecycle and promotion integration are not implemented.

- [ ] **Step 2: Add runtime state and timer helpers**

Import both helpers and define state:

```js
const { getExchangeOutcome, promoteItemById } = window.ReadingHutExchange;
const NEW_TAG_DURATION_MS = 5000;
const newTagTimers = new Map();
let successTipTimer = null;
let latestExchangeItemId = null;
let currentExchangeCategory = null;
```

Add `showExchangeSuccessTip(category, itemId)`, `hideExchangeSuccessTip()`, `scheduleNewTagExpiry(category, item)`, and `promoteRedeemedItem(category, item)` functions. The bubble text must select `家具` or `装饰`, reset its five-second timer on every successful exchange, and expose `aria-hidden="false"` only while visible.

- [ ] **Step 3: Render NEW from its deadline**

Replace the static `item.isNew` branch with:

```js
if (item.newUntil > Date.now()) {
  const newTag = document.createElement('img');
  newTag.className = 'bag-item-new';
  newTag.src = './assets/item-new-tag.png';
  newTag.alt = 'NEW';
  card.appendChild(newTag);
}
```

- [ ] **Step 4: Track the category and promote the item after a successful exchange**

Change `openExchangeDialog(item)` to `openExchangeDialog(item, category)` and assign `currentExchangeCategory = category`. Pass `card.dataset.category` from the item-list click handler.

In the confirmation handler, after deducting stars and setting `item.unlocked = true`:

```js
item.newUntil = Date.now() + NEW_TAG_DURATION_MS;
ITEMS[category] = promoteItemById(ITEMS[category], item.id);
renderItems(category);
itemList.scrollLeft = 0;
scheduleNewTagExpiry(category, item);
showExchangeSuccessTip(category, item.id);
```

Capture the category before `closeExchangeDialog()` clears transient state. Remove or bypass the old single-card update path because the ordered list is fully re-rendered.

- [ ] **Step 5: Implement early bubble dismissal**

- In the item-list click handler, call `hideExchangeSuccessTip()` when the clicked card id equals `latestExchangeItemId`.
- In `closeBag()`, call `hideExchangeSuccessTip()`.
- Do not remove the NEW tag early when either event occurs.
- When a NEW timer expires, set `item.newUntil = 0` and remove/re-render only if the same category is currently open.

- [ ] **Step 6: Run the new test and verify GREEN**

Run: `node --test tests/reading-hut-exchange-success-feedback.test.js`

Expected: all success-feedback tests pass.

- [ ] **Step 7: Commit**

```bash
git add reading-hut.html tests/reading-hut-exchange-success-feedback.test.js
git commit -m "feat: complete exchange success feedback"
```

### Task 4: Regression and rendered interaction verification

**Files:**
- Verify: `reading-hut.html`
- Verify: `reading-hut.css`
- Verify: `reading-hut-exchange.js`
- Verify: `tests/*.test.js`

- [ ] **Step 1: Run JavaScript syntax checks**

Run:

```powershell
node --check reading-hut-exchange.js
```

Extract the inline script from `reading-hut.html` and compile it with `new Function`. Expected: both commands exit `0`.

- [ ] **Step 2: Run the full test suite**

Run: `node --test tests\*.test.js`

Expected: all tests pass with zero failures and zero warnings.

- [ ] **Step 3: Verify the rendered flow at 394 × 852**

Exercise:

1. Open the furniture Panel.
2. Exchange the 10-star rug.
3. Confirm the balance changes from 30 to 20.
4. Confirm the rug becomes colored, moves to the first card, shows NEW, and the success bubble shows the furniture copy.
5. Confirm NEW and the bubble disappear after five seconds.
6. Exchange an affordable decoration and confirm the decoration copy and category-local promotion.
7. Open an insufficient item and confirm the same `rgba(51,51,51,0.8)` scrim without deducting stars.

Expected: no horizontal clipping, broken images, console errors, or interference with Panel drag.

- [ ] **Step 4: Inspect the final diff and commit verification-ready state**

Run:

```bash
git diff --check
git status --short
```

If verification produced no source changes, do not create an empty commit.
