const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');

test('decoration button opens the shared panel with decoration artwork', () => {
  assert.match(html, /querySelector\('\.room-action-decorations'\)/);
  assert.match(html, /openPanel\('decoration', true\)/);
  assert.match(html, /bag-panel-decorative\.png/);
  assert.match(html, /renderItems\(category\)/);
});

test('furniture and decoration reuse the same animated panel', () => {
  assert.match(html, /function openPanel\(category, animate\)/);
  assert.match(html, /page\.classList\.add\('bag-open'\)/);
  assert.equal((html.match(/<section class="bag-panel"/g) || []).length, 1);
});

test('decoration panel uses the four latest Figma cards in order', () => {
  const decorationBlock = html.match(/decoration:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || '';
  assert.match(decorationBlock, /id:\s*'plant'[\s\S]*id:\s*'star-sticker'[\s\S]*id:\s*'doll'[\s\S]*id:\s*'story-wall'/);
  assert.equal((decorationBlock.match(/unlocked:\s*false/g) || []).length, 4);
  assert.equal((decorationBlock.match(/stars:\s*10/g) || []).length, 3);
  assert.equal((decorationBlock.match(/stars:\s*15/g) || []).length, 1);
  assert.doesNotMatch(decorationBlock, /星币罐摆件|阅读相框/);
});

test('decoration thumbnails use their individual Figma coordinates', () => {
  assert.match(css, /\.bag-item\[data-item-id="plant"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*14px;[^}]*top:\s*18px;[^}]*width:\s*58px;[^}]*height:\s*70px;/s);
  assert.match(css, /\.bag-item\[data-item-id="star-sticker"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*7px;[^}]*top:\s*29px;[^}]*width:\s*70px;[^}]*height:\s*48px;/s);
  assert.match(css, /\.bag-item\[data-item-id="doll"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*16px;[^}]*top:\s*19px;[^}]*width:\s*54px;[^}]*height:\s*70px;/s);
  assert.match(css, /\.bag-item\[data-item-id="story-wall"\][^{]*\.bag-item-thumb\s*\{[^}]*left:\s*8px;[^}]*top:\s*25px;[^}]*width:\s*70px;[^}]*height:\s*62px;/s);
});

test('room uses the provided vectorized doll and story-wall PNG exports', () => {
  assert.match(html, /data-slot="doll"[^>]*data-item-id="doll"/);
  assert.match(html, /class="placement-ghost placement-doll-ghost"[^>]*src="\.\/assets\/hut-ghost-doll-off\.png"/);
  assert.match(html, /data-slot="story-wall"[^>]*data-item-id="story-wall"/);
  assert.match(html, /class="placement-ghost placement-story-wall-ghost"[^>]*src="\.\/assets\/hut-ghost-story-wall-off\.png"/);
  assert.doesNotMatch(html, /ghost-doll-crop|ghost-story-wall-crop|hut-ghost-(?:doll|story-wall)-source\.png/);
  assert.match(css, /\.ghost-doll-slot\s*\{[^}]*left:\s*71px;[^}]*top:\s*226px;[^}]*width:\s*38px;[^}]*height:\s*46\.9063px;/s);
  assert.match(css, /\.ghost-story-wall-slot\s*\{[^}]*left:\s*147px;[^}]*top:\s*181px;[^}]*width:\s*90px;[^}]*height:\s*80px;/s);
  assert.match(css, /\.placement-story-wall-item\s*\{[^}]*left:\s*10px;[^}]*top:\s*9px;[^}]*width:\s*70px;[^}]*height:\s*62px;[^}]*transform-origin:\s*center;[^}]*scale:\s*-1 1;/s);
});

test('provided off-state assets are copied without modification', () => {
  const expected = {
    'item-doll-off.png': 'af5dd49cfbbc1487df8c367b2e911bd09e6de68defaee0e8d76b92270ec0da76',
    'item-story-wall-off.png': 'de367cf969482cf6c57460a89d47b336196bcf843d72989595b7a034d8600e72',
    'hut-ghost-doll-off.png': '6718c5be3aa91c5e19dd6ffaef07157a677968b29bdc2b412e613d2669faed33',
    'hut-ghost-story-wall-off.png': '4bab8b611c2238c1d219115325b4d66c061da062ed29691d66ba1044bdd330e1',
  };
  for (const [name, hash] of Object.entries(expected)) {
    const bytes = fs.readFileSync(path.join(root, 'assets', name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), hash, name);
  }
});

test('room includes the new Figma star-sticker ghost placement', () => {
  assert.match(html, /class="placement-slot ghost-slot ghost-star-sticker-slot"/);
  assert.match(html, /item-star-sticker-off\.png/);
  assert.match(html, /hut-ghost-star-sticker-outline\.svg/);
  assert.match(css, /\.ghost-star-sticker-slot\s*\{[^}]*left:\s*240px;[^}]*top:\s*110px;[^}]*width:\s*127\.541862px;[^}]*height:\s*88\.441437px;/s);
  assert.match(css, /\.ghost-star-sticker-item\s*\{[^}]*opacity:\s*0\.5;/s);
});
