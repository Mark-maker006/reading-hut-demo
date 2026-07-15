# Panel Horizontal Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag or swipe the shared furniture/decoration card list horizontally without accidental card activation.

**Architecture:** Keep the existing native overflow container and add one Pointer Events controller to the shared `.bag-item-list`. The controller tracks one active pointer, applies a 6px drag threshold, updates `scrollLeft`, and suppresses only the click produced by a completed drag.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner

---

### Task 1: Shared horizontal drag controller

**Files:**
- Modify: `tests/reading-hut-figma-panels.test.js`
- Modify: `reading-hut.css:502-520`
- Modify: `reading-hut.html:92-220`

- [ ] **Step 1: Write the failing interaction contract test**

Add a test that requires:

```js
test('shared item list supports horizontal pointer dragging without accidental clicks', () => {
  assert.match(css, /\.bag-item-list\s*\{[^}]*touch-action:\s*pan-y;[^}]*cursor:\s*grab;/s);
  assert.match(css, /\.bag-item-list\.is-dragging\s*\{[^}]*cursor:\s*grabbing;/s);
  assert.match(html, /const DRAG_THRESHOLD = 6/);
  assert.match(html, /itemList\.addEventListener\('pointerdown'/);
  assert.match(html, /itemList\.addEventListener\('pointermove'/);
  assert.match(html, /itemList\.addEventListener\('pointerup'/);
  assert.match(html, /itemList\.addEventListener\('pointercancel'/);
  assert.match(html, /itemList\.setPointerCapture\(e\.pointerId\)/);
  assert.match(html, /itemList\.scrollLeft = dragState\.startScrollLeft - deltaX/);
  assert.match(html, /if \(dragState\.didDrag\)[\s\S]*e\.preventDefault\(\)/);
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```powershell
node --test tests\reading-hut-figma-panels.test.js
```

Expected: FAIL because the pointer handlers and drag CSS do not exist.

- [ ] **Step 3: Add the CSS interaction affordances**

Extend `.bag-item-list` and add its dragging state:

```css
.bag-item-list {
  touch-action: pan-y;
  cursor: grab;
}

.bag-item-list.is-dragging {
  cursor: grabbing;
  user-select: none;
}
```

- [ ] **Step 4: Add the shared Pointer Events controller**

Add one controller beside the existing panel functions:

```js
const DRAG_THRESHOLD = 6;
const dragState = {
  pointerId: null,
  startX: 0,
  startScrollLeft: 0,
  didDrag: false,
  suppressClick: false,
};

function finishItemListDrag(e) {
  if (dragState.pointerId !== e.pointerId) return;
  dragState.suppressClick = dragState.didDrag;
  dragState.pointerId = null;
  itemList.classList.remove('is-dragging');
}

itemList.addEventListener('pointerdown', function (e) {
  if (e.button !== 0) return;
  dragState.pointerId = e.pointerId;
  dragState.startX = e.clientX;
  dragState.startScrollLeft = itemList.scrollLeft;
  dragState.didDrag = false;
  dragState.suppressClick = false;
  itemList.setPointerCapture(e.pointerId);
});

itemList.addEventListener('pointermove', function (e) {
  if (dragState.pointerId !== e.pointerId) return;
  const deltaX = e.clientX - dragState.startX;
  if (!dragState.didDrag && Math.abs(deltaX) < DRAG_THRESHOLD) return;
  dragState.didDrag = true;
  itemList.classList.add('is-dragging');
  itemList.scrollLeft = dragState.startScrollLeft - deltaX;
});

itemList.addEventListener('pointerup', finishItemListDrag);
itemList.addEventListener('pointercancel', finishItemListDrag);
itemList.addEventListener('click', function (e) {
  if (!dragState.suppressClick) return;
  e.preventDefault();
  e.stopPropagation();
  dragState.suppressClick = false;
}, true);
```

Set `itemList.scrollLeft = 0` at the start of `renderItems(category)` so both categories open at their first card.

- [ ] **Step 5: Run the targeted test and verify GREEN**

Run:

```powershell
node --test tests\reading-hut-figma-panels.test.js
```

Expected: all targeted tests pass.

- [ ] **Step 6: Run the full regression suite**

Run:

```powershell
node --test tests\*.test.js
```

Expected: all tests pass with zero failures.

- [ ] **Step 7: Verify the rendered interaction**

At `393×852`, open each panel and verify:

1. Horizontal touch/mouse drag changes `scrollLeft`.
2. A drag does not activate a card.
3. A normal click still activates clickable furniture cards.
4. Furniture and decoration both reset to their first card when opened.
5. No console warnings or errors appear.

The workspace is not a Git repository, so no commit step is available.
