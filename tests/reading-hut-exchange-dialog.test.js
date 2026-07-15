const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');
const logicPath = path.join(root, 'reading-hut-exchange.js');

test('exchange decision treats an equal balance as sufficient', () => {
  assert.equal(fs.existsSync(logicPath), true, 'reading-hut-exchange.js should exist');
  const { getExchangeOutcome } = require(logicPath);
  assert.deepEqual(getExchangeOutcome(10, 10), {
    canAfford: true,
    missing: 0,
    remaining: 0,
  });
  assert.deepEqual(getExchangeOutcome(30, 45), {
    canAfford: false,
    missing: 15,
    remaining: 30,
  });
});

test('dialog shell uses local Figma assets and exact parent geometry', () => {
  assert.match(html, /class="exchange-overlay"[^>]*aria-hidden="true"/);
  assert.match(html, /class="exchange-dialog"[^>]*role="dialog"[^>]*data-mode="sufficient"/);
  assert.match(html, /exchange-dialog-source\.png/);
  assert.match(html, /exchange-dialog-star\.svg/);
  assert.match(css, /\.exchange-dialog\s*\{[^}]*width:\s*341px;[^}]*height:\s*446px;/s);
  assert.match(css, /\.exchange-dialog-bg img\s*\{[^}]*height:\s*110\.99%;[^}]*left:\s*-5\.65%;[^}]*top:\s*-6\.5%;[^}]*width:\s*217\.74%;/s);
  assert.doesNotMatch(html + css, /figma\.com\/api\/mcp\/asset/);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'exchange-dialog-source.png')), true);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'exchange-dialog-star.svg')), true);
});

test('sufficient mode follows the Figma 219:1899 inspector geometry', () => {
  assert.match(html, /class="exchange-mode exchange-mode-sufficient"/);
  assert.match(css, /\.exchange-mode-sufficient\s*\{[^}]*left:\s*40px;[^}]*top:\s*31px;[^}]*width:\s*262px;[^}]*height:\s*382px;/s);
  assert.match(css, /\.exchange-sufficient-preview\s*\{[^}]*left:\s*48px;[^}]*top:\s*52px;[^}]*width:\s*166px;[^}]*height:\s*122px;/s);
  assert.match(css, /\.exchange-sufficient-details\s*\{[^}]*left:\s*0;[^}]*top:\s*189px;[^}]*width:\s*262px;[^}]*height:\s*132px;/s);
  assert.match(css, /\.exchange-sufficient-actions\s*\{[^}]*left:\s*0;[^}]*top:\s*336px;[^}]*width:\s*262px;[^}]*height:\s*46px;/s);
  assert.match(html, /再想想/);
  assert.match(html, /确认兑换/);
});

test('insufficient mode follows the Figma 219:1905 inspector geometry', () => {
  assert.match(html, /class="exchange-mode exchange-mode-insufficient"/);
  assert.match(css, /\.exchange-mode-insufficient\s*\{[^}]*left:\s*40px;[^}]*top:\s*32px;[^}]*width:\s*262px;[^}]*height:\s*382px;/s);
  assert.match(css, /\.exchange-insufficient-preview\s*\{[^}]*left:\s*0;[^}]*top:\s*47px;[^}]*width:\s*262px;[^}]*height:\s*138px;/s);
  assert.match(css, /\.exchange-insufficient-details\s*\{[^}]*left:\s*0;[^}]*top:\s*195px;[^}]*width:\s*262px;[^}]*height:\s*131px;/s);
  assert.match(css, /\.exchange-insufficient-actions\s*\{[^}]*left:\s*0;[^}]*top:\s*336px;[^}]*width:\s*262px;[^}]*height:\s*46px;/s);
  assert.match(html, /暂不兑换/);
  assert.match(html, /去完成计划/);
});

test('locked card clicks branch on balance and confirmation performs a real exchange', () => {
  assert.match(html, /const \{ getExchangeOutcome \} = window\.ReadingHutExchange;/);
  assert.match(html, /const outcome = getExchangeOutcome\(starBalance, item\.stars\);/);
  assert.match(html, /dialog\.dataset\.mode = outcome\.canAfford \? 'sufficient' : 'insufficient';/);
  assert.match(html, /starBalance = outcome\.remaining;/);
  assert.match(html, /item\.unlocked = true;/);
  assert.match(html, /starCount\.textContent = starBalance;/);
  assert.match(html, /card\.dataset\.state = 'on';/);
  assert.match(html, /thumb\.src = item\.img;/);
  assert.match(html, /closeExchangeDialog\(\);/);
});
