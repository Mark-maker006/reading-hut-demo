const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');

test('bag cards do not keep a raised intermediate selection state', () => {
  assert.match(
    css,
    /\.bag-item-list\s*\{[^}]*top:\s*41px;[^}]*height:\s*138px;[^}]*padding:\s*6px 0;/s,
  );
  assert.doesNotMatch(css, /\.bag-item\.is-selected/);
  assert.doesNotMatch(html, /selectBagItem|selectedItemId|selectedCategory/);
});

test('unlocked furniture starts native placement motion on its first click', {
  timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 394, height: 852 } });
    await page.goto(pathToFileURL(path.join(root, 'reading-hut.html')).href);

    await page.locator('.room-action-bag').click();
    await page.waitForTimeout(450);
    await page.locator('.bag-item[data-item-id="reading-rug"]').evaluate((card) => card.click());
    await page.locator('.exchange-confirm').click();

    const card = page.locator('.bag-item[data-item-id="reading-rug"]');
    await card.evaluate((node) => node.click());

    assert.equal(await page.locator('.placement-motion-layer').getAttribute('aria-hidden'), 'false');
    assert.equal(await page.locator('.placement-flyer').count(), 1);
    assert.match(await page.locator('.placement-flight-path').getAttribute('d'), /^M /);
  } finally {
    await browser.close();
  }
});

test('unlocked decoration starts native placement motion on its first click', {
  timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 394, height: 852 } });
    await page.goto(pathToFileURL(path.join(root, 'reading-hut.html')).href);

    await page.locator('.room-action-decorations').click();
    await page.waitForTimeout(450);
    await page.locator('.bag-item[data-item-id="plant"]').evaluate((card) => card.click());
    await page.locator('.exchange-confirm').click();

    const card = page.locator('.bag-item[data-item-id="plant"]');
    await card.evaluate((node) => node.click());

    assert.equal(await page.locator('.placement-motion-layer').getAttribute('aria-hidden'), 'false');
    assert.equal(await page.locator('.placement-flyer').count(), 1);
  } finally {
    await browser.close();
  }
});

test('locked items still use the exchange dialog on their first click', () => {
  assert.match(
    html,
    /if \(!item\) return;[\s\S]*if \(item\.unlocked\)[\s\S]*startPlacement\(item, card\.dataset\.category, card\);[\s\S]*openExchangeDialog\(item, card\.dataset\.category\);/,
  );
});
