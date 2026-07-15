# Star Exchange Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pixel-matched sufficient/insufficient exchange dialogs and real in-memory star exchange behavior to the Reading Hut bag cards.

**Architecture:** Add one static reusable dialog shell to `reading-hut.html`, switch its content with `data-mode`, and keep the balance and item unlock flags in the existing script state. Reuse current item records and card rendering; update only the exchanged card in place so horizontal scroll position is preserved.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner

---

### Task 1: Local Figma assets and failing contract tests

**Files:**
- Create: `assets/exchange-dialog-bg.png`
- Create: `assets/exchange-dialog-star.png`
- Create: `tests/reading-hut-exchange-dialog.test.js`

- [ ] Download/export the Figma background and 26px star icon to local assets.
- [ ] Add tests for `341×446` geometry, sufficient/insufficient content, local asset references, and no Figma URLs.
- [ ] Add tests for the `balance >= item.stars` branch and real exchange mutations.
- [ ] Run `node --test tests\reading-hut-exchange-dialog.test.js` and verify failure because the dialog is missing.

### Task 2: Dialog markup and pixel-matched styling

**Files:**
- Modify: `reading-hut.html`
- Modify: `reading-hut.css`

- [ ] Add the reusable dialog shell, dynamic text spans, preview image, sufficient/insufficient detail rows, and four action buttons.
- [ ] Implement the Figma geometry and visual tokens from nodes `219:1899` and `219:1905`.
- [ ] Center the dialog and add a transparent interaction-blocking overlay.
- [ ] Run the targeted test and verify visual-contract assertions pass.

### Task 3: Balance decision and real exchange behavior

**Files:**
- Modify: `reading-hut.html`
- Test: `tests/reading-hut-exchange-dialog.test.js`

- [ ] Parse the initial balance from `.room-star-count`.
- [ ] Intercept clicks on locked `.bag-item` elements and open the correct mode.
- [ ] Populate item name, colored preview, price, balance, missing amount, and remaining amount.
- [ ] On confirm, deduct balance, unlock the item, update the top bar and card, then close the dialog.
- [ ] Wire cancel, plan, backdrop, and Escape actions without mutating exchange state.
- [ ] Run the targeted test, then `node --test tests\*.test.js`.
- [ ] Validate every inline script with `new Function` syntax parsing.

The workspace is not a Git repository, so worktree and commit steps are unavailable.
