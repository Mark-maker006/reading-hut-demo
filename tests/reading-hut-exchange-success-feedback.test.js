const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const { promoteItemById } = require('../reading-hut-exchange.js');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');

test('promoteItemById moves only the redeemed item to the front', () => {
  const items = [{ id: 'rug' }, { id: 'floor' }, { id: 'shelf' }];

  assert.deepEqual(promoteItemById(items, 'shelf').map((item) => item.id), [
    'shelf',
    'rug',
    'floor',
  ]);
  assert.deepEqual(items.map((item) => item.id), ['rug', 'floor', 'shelf']);
});

test('exchange success tip has a dedicated accessible element', () => {
  assert.match(
    html,
    /class="exchange-success-tip"[^>]*aria-label="兑换成功提示"[^>]*aria-hidden="true"/,
  );
});

test('exchange dialog uses the exact Figma scrim color', () => {
  assert.match(
    css,
    /\.exchange-overlay\s*\{[^}]*background:\s*rgba\(51, 51, 51, 0\.8\);/s,
  );
});

test('NEW tag keeps the Figma card coordinates and local artwork', () => {
  assert.match(
    css,
    /\.bag-item-new\s*\{[^}]*top:\s*0;[^}]*left:\s*0;[^}]*width:\s*29\.523px;[^}]*height:\s*22\.605px;/s,
  );
  assert.match(html, /\.\/assets\/item-new-tag\.png/);
  assert.doesNotMatch(html + css, /figma\.com\/api\/mcp\/asset/);
});

test('exchange success lifecycle is wired to five-second item deadlines', () => {
  assert.match(html, /const NEW_TAG_DURATION_MS = 5000;/);
  assert.match(html, /item\.newUntil = Date\.now\(\) \+ NEW_TAG_DURATION_MS;/);
  assert.match(
    html,
    /ITEMS\[category\] = promoteItemById\(ITEMS\[category\], item\.id\);/,
  );
  assert.match(html, /showExchangeSuccessTip\(category, item\.id\);/);
  assert.match(
    html,
    /if \(card\.dataset\.itemId === latestExchangeItemId\) hideExchangeSuccessTip\(\);/,
  );
});

test(
  'a real exchange promotes the card and expires the success feedback after five seconds',
  { timeout: 15000 },
  async () => {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({ viewport: { width: 394, height: 852 } });
      await page.goto(pathToFileURL(path.join(root, 'reading-hut.html')).href);

      await page.locator('.room-action-bag').click();
      await page.waitForTimeout(450);
      await page.locator('.bag-item[data-item-id="wood-floor"]').evaluate((card) => card.click());
      await page.locator('.exchange-confirm').click();

      assert.equal(await page.locator('.room-star-count').textContent(), '480');
      assert.equal(await page.locator('.bag-item').first().getAttribute('data-item-id'), 'wood-floor');
      assert.equal(await page.locator('.bag-item').first().getAttribute('data-state'), 'on');
      assert.equal(await page.locator('.bag-item-new').count(), 1);
      assert.equal(await page.locator('.exchange-success-tip').getAttribute('aria-hidden'), 'false');
      assert.match(await page.locator('.exchange-success-tip').textContent(), /刚刚兑换的家具/);

      await page.waitForTimeout(5100);

      assert.equal(await page.locator('.bag-item-new').count(), 0);
      assert.equal(await page.locator('.exchange-success-tip').getAttribute('aria-hidden'), 'true');
    } finally {
      await browser.close();
    }
  },
);
