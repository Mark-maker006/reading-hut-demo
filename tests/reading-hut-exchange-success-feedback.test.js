const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
