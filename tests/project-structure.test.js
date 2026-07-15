const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const activePages = [
  'achievement.html',
  'illustration-book.html',
  'index.html',
  'level-map.html',
  'placement-video.html',
  'reading-hut.html',
];

const activeSources = [
  ...activePages,
  'achievement.css',
  'illustration-book.css',
  'illustration-book.js',
  'level-map.css',
  'placement-video.css',
  'placement-video.js',
  'reading-hut.css',
  'reading-hut-exchange.js',
  'styles.css',
];

const obsoleteAssets = [
  'assets/bag-bookshelf-disable.png',
  'assets/bag-mascot.png',
  'assets/bag-panel-decoration.png',
  'assets/bag-panel.png',
  'assets/decorate-page.png',
  'assets/furniture-catalog-4.png',
  'assets/growth-town-reference.png',
  'assets/hero-mascot-layer.png',
  'assets/hut-ghost-floor.png',
  'assets/hut-ghost-plant.png',
  'assets/hut-ghost-rug.png',
  'assets/hut-panel-decoration.png',
  'assets/hut-panel-furniture.png',
  'assets/ib-furn-content.png',
  'assets/item-coin-jar-off.png',
  'assets/item-coin-jar-on.png',
  'assets/item-photo-frame-off.png',
  'assets/item-photo-frame-on.png',
  'assets/pure-map.png',
  'assets/room-button-store.png',
  'assets/room-stars-30.png',
  'assets/room-stars.png',
  'assets/sprite-bottom.png',
  'assets/sprite-furn-content.png',
  'assets/sprite-grid-preview.png',
  'assets/sprite-top.png',
  'assets/store-page.png',
  'assets/town-map-panel.png',
];

test('root contains only active HTML entry points', () => {
  const pages = fs.readdirSync(root)
    .filter((name) => name.endsWith('.html'))
    .sort();

  assert.deepEqual(pages, activePages);
});

test('active pages and scripts have no broken local references', () => {
  for (const source of activeSources) {
    const contents = fs.readFileSync(path.join(root, source), 'utf8');
    const references = [...contents.matchAll(/["'](\.\/[^"']+)["']/g)]
      .map((match) => match[1].split(/[?#]/, 1)[0]);

    for (const reference of references) {
      assert.equal(
        fs.existsSync(path.resolve(root, reference)),
        true,
        `${source} references missing file ${reference}`,
      );
    }
  }
});

test('obsolete runtime assets are removed', () => {
  for (const asset of obsoleteAssets) {
    assert.equal(fs.existsSync(path.join(root, asset)), false, `${asset} should be removed`);
  }
});

test('root does not contain local visual-QA artifacts', () => {
  const clutter = fs.readdirSync(root)
    .filter((name) => name.startsWith('_') || /^ss-.*\.png$/.test(name) || name.endsWith('.log'))
    .sort();

  assert.deepEqual(clutter, []);
});
