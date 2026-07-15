const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');

test('selected item card has a raised shadow state without changing its resting position', () => {
  assert.match(
    css,
    /\.bag-item-list\s*\{[^}]*top:\s*41px;[^}]*height:\s*138px;[^}]*padding:\s*6px 0;/s,
  );
  assert.match(
    css,
    /\.bag-item\.is-selected \.bag-item-card\s*\{[^}]*transform:\s*translateY\(-5px\);[^}]*box-shadow:/s,
  );
});

test('unlocked furniture requires one click to select and a second click to open placement video', {
  timeout: 15000,
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 394, height: 852 } });
    const readingHutUrl = pathToFileURL(path.join(root, 'reading-hut.html')).href;
    await page.goto(readingHutUrl);

    await page.locator('.room-action-bag').click();
    await page.waitForTimeout(450);
    await page.locator('.bag-item[data-item-id="reading-rug"]').evaluate((card) => card.click());
    await page.locator('.exchange-confirm').click();

    const card = page.locator('.bag-item[data-item-id="reading-rug"]');
    await card.evaluate((node) => node.click());
    await page.waitForTimeout(100);

    assert.equal(page.url(), readingHutUrl);
    assert.equal(await card.getAttribute('class'), 'bag-item is-selected');
    assert.notEqual(
      await card.locator('.bag-item-card').evaluate((node) => getComputedStyle(node).boxShadow),
      'none',
    );

    await page.locator('.bag-close').click();
    await page.locator('.room-action-bag').click();
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.bag-item.is-selected').count(), 0);

    const reopenedCard = page.locator('.bag-item[data-item-id="reading-rug"]');
    await reopenedCard.evaluate((node) => node.click());
    await Promise.all([
      page.waitForURL(/placement-video\.html$/),
      reopenedCard.evaluate((node) => node.click()),
    ]);
  } finally {
    await browser.close();
  }
});

test('locked items still use the exchange dialog on their first click', () => {
  assert.match(
    html,
    /if \(!item\) return;[\s\S]*if \(item\.unlocked\)[\s\S]*e\.preventDefault\(\);\s*openExchangeDialog\(item, card\.dataset\.category\);/,
  );
});
