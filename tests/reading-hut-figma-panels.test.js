const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');

test('room renders all updated Figma ghost placements', () => {
  assert.match(html, /hut-ghost-floor\.svg/);
  assert.match(html, /hut-ghost-bookshelf\.png/);
  assert.match(html, /hut-ghost-rug-outline\.svg/);
  assert.match(html, /item-reading-rug-off\.png/);
  assert.match(html, /hut-ghost-plant-outline\.svg/);
  assert.match(html, /item-plant-off\.png/);
  assert.match(css, /\.ghost-floor-overlay\s*\{[^}]*left:\s*0;[^}]*top:\s*341px;[^}]*width:\s*393px;[^}]*height:\s*511px;/s);
  assert.match(css, /\.ghost-bookshelf-slot\s*\{[^}]*left:\s*28px;[^}]*top:\s*473px;[^}]*width:\s*122\.105px;[^}]*height:\s*145px;/s);
  assert.match(css, /\.ghost-rug-slot\s*\{[^}]*left:\s*165px;[^}]*top:\s*436px;[^}]*width:\s*186px;[^}]*height:\s*140px;/s);
  assert.match(css, /\.ghost-plant-slot\s*\{[^}]*left:\s*28px;[^}]*top:\s*221px;[^}]*width:\s*42\.705px;[^}]*height:\s*52\.047px;/s);
});

test('topbar uses the updated 30-star Figma node', () => {
  assert.match(html, /class="room-stars"[^>]*aria-label="30 stars"/);
  assert.match(html, /room-star-icon\.svg/);
  assert.match(html, /room-star-plus\.png/);
  assert.match(html, /class="room-star-count"[^>]*>30</);
  assert.match(css, /\.room-stars\s*\{[^}]*position:\s*absolute;[^}]*left:\s*279px;[^}]*top:\s*4px;[^}]*width:\s*94px;[^}]*height:\s*30px;/s);
});

test('ghost and star nodes use transparent layers rather than white flattened exports', () => {
  assert.doesNotMatch(html, /hut-ghost-floor\.png/);
  assert.doesNotMatch(html, /hut-ghost-rug\.png/);
  assert.doesNotMatch(html, /hut-ghost-plant\.png/);
  assert.doesNotMatch(html, /room-stars-30\.png/);
  assert.match(css, /\.ghost-rug-item\s*\{[^}]*opacity:\s*0\.3;/s);
  assert.match(css, /\.ghost-plant-item\s*\{[^}]*opacity:\s*0\.6;/s);
});

test('shared panel preserves the Figma card position and vertical headroom', () => {
  assert.match(html, /class="bag-panel-bg"/);
  assert.match(html, /bag-panel-furniture\.png/);
  assert.match(html, /bag-panel-decorative\.png/);
  assert.match(html, /panelBg\.src\s*=\s*isDecoration/);
  assert.match(css, /\.bag-panel\s*\{[^}]*left:\s*15px;[^}]*bottom:\s*16px;[^}]*width:\s*362px;[^}]*height:\s*192px;/s);
  assert.match(css, /\.bag-item-list\s*\{[^}]*top:\s*41px;[^}]*left:\s*10px;[^}]*width:\s*343px;[^}]*height:\s*138px;[^}]*padding:\s*6px 0;/s);
  assert.match(css, /\.bag-item-list\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s);
  assert.match(css, /\.bag-item-card\s*\{[^}]*width:\s*87px;[^}]*height:\s*126px;/s);
});

test('shared item list supports horizontal pointer dragging without accidental clicks', () => {
  assert.match(css, /\.bag-item-list\s*\{[^}]*touch-action:\s*pan-y;[^}]*cursor:\s*grab;/s);
  assert.match(css, /\.bag-item-list\.is-dragging\s*\{[^}]*cursor:\s*grabbing;/s);
  assert.match(html, /const DRAG_THRESHOLD = 6;/);
  assert.match(html, /itemList\.addEventListener\('pointerdown'/);
  assert.match(html, /itemList\.addEventListener\('pointermove'/);
  assert.match(html, /itemList\.addEventListener\('pointerup'/);
  assert.match(html, /itemList\.addEventListener\('pointercancel'/);
  assert.match(html, /itemList\.setPointerCapture\(e\.pointerId\)/);
  assert.match(html, /itemList\.scrollLeft = dragState\.startScrollLeft - deltaX;/);
  assert.match(html, /if \(!dragState\.suppressClick\) return;[\s\S]*e\.preventDefault\(\);/);
  assert.match(html, /function renderItems\(category\)\s*\{\s*itemList\.scrollLeft = 0;/);
});

test('furniture thumbnails use the individual Figma coordinates', () => {
  assert.match(html, /id:\s*'reading-rug'/);
  assert.match(html, /id:\s*'wood-floor'/);
  assert.match(html, /id:\s*'bookshelf'/);
  assert.match(html, /name:\s*'木地板'/);
  assert.match(html, /item-star-tag\.png/);
  assert.match(css, /\.bag-item\[data-item-id="reading-rug"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*10px;[^}]*top:\s*29px;[^}]*width:\s*68px;[^}]*height:\s*50px;/s);
  assert.match(css, /\.bag-item\[data-item-id="wood-floor"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*9px;[^}]*top:\s*28\.5px;[^}]*width:\s*70px;[^}]*height:\s*47px;/s);
  assert.match(css, /\.bag-item\[data-item-id="bookshelf"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*13px;[^}]*top:\s*20px;[^}]*width:\s*59px;[^}]*height:\s*70px;/s);
});

test('furniture cards use the latest Figma on and off states', () => {
  assert.match(html, /id:\s*'reading-rug'[^\n]*unlocked:\s*false/);
  assert.match(html, /id:\s*'wood-floor'[^\n]*unlocked:\s*false/);
  assert.match(html, /id:\s*'bookshelf'[^\n]*imgOff:\s*'\.\/assets\/bag-bookshelf-off\.png'[^\n]*unlocked:\s*false/);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'bag-bookshelf-off.png')), true, 'bag-bookshelf-off.png should exist');
  assert.match(html, /thumb\.src\s*=\s*item\.unlocked\s*\?\s*item\.img\s*:\s*item\.imgOff/);
  assert.match(html, /el\.dataset\.state\s*=\s*item\.unlocked\s*\?\s*'on'\s*:\s*'off'/);
  assert.doesNotMatch(html, /id:\s*'reading-rug'[^\n]*isNew:\s*true/);
});

test('upgraded open state uses the Figma mascot placement and hides guidance bubbles', () => {
  assert.match(html, /hut-mascot\.png/);
  assert.match(css, /\.room-mascot\s*\{[^}]*left:\s*236px;[^}]*top:\s*473px;[^}]*width:\s*147px;[^}]*height:\s*179px;/s);
  assert.match(css, /\.bag-open \.room-mascot\s*\{[^}]*transform:\s*none;/s);
  assert.match(css, /\.bag-open \.room-tip[\s\S]*display:\s*none;/);
});

test('mascot glides between the closed and open Figma geometry over 600ms', () => {
  assert.match(css, /\.room-mascot\s*\{[^}]*left:\s*236px;[^}]*top:\s*473px;[^}]*width:\s*147px;[^}]*height:\s*179px;[^}]*transform-origin:\s*top left;[^}]*transform:\s*translate\(17px,\s*32px\) scale\(0\.796,\s*0\.799\);[^}]*transition:\s*transform 600ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\);/s);
  assert.match(css, /\.bag-open \.room-mascot\s*\{[^}]*transform:\s*none;/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.room-mascot\s*\{[^}]*transition:\s*none;/s);
});

test('panel assets are local and no Figma temporary URLs are shipped', () => {
  assert.doesNotMatch(html, /figma\.com\/api\/mcp\/asset/);
  for (const name of [
    'bag-panel-furniture.png',
    'bag-panel-decorative.png',
    'item-card.png',
    'item-star-tag.png',
    'hut-ghost-floor.svg',
    'hut-ghost-bookshelf.png',
    'hut-ghost-rug-outline.svg',
    'hut-ghost-plant-outline.svg',
    'hut-ghost-doll-off.png',
    'hut-ghost-story-wall-off.png',
    'hut-ghost-star-sticker-outline.svg',
    'room-star-icon.svg',
    'room-star-plus.png',
    'hut-mascot.png'
  ]) {
    assert.equal(fs.existsSync(path.join(root, 'assets', name)), true, `${name} should exist`);
  }
});
