const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'level-map.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'level-map.css'), 'utf8');

function occurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

function readPngDimensions(fileName) {
  const header = fs.readFileSync(path.join(root, 'assets', fileName)).subarray(0, 24);
  assert.deepEqual(header.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
}

test('uses the exact Lanhu final map composite', () => {
  assert.deepEqual(readPngDimensions('map-final-lanhu.png'), { width: 375, height: 812 });
  assert.equal(occurrences(html, /class="map-final-art"/g), 1);
  assert.match(html, /src="\.\/assets\/map-final-lanhu\.png"/);
});

test('does not render obsolete layered map artwork', () => {
  for (const asset of [
    'map-base.png',
    'map-start.png',
    'map-house.png',
    'map-star-award.png',
    'map-flag.png',
    'map-house-locked.png',
    'map-back.png',
    'map-star-count.png',
    'map-achievement-icon.png',
    'map-coming-button.png',
  ]) {
    assert.doesNotMatch(html, new RegExp(`assets/${asset.replace('.', '\\.')}`));
  }
});

test('keeps the three existing navigation targets', () => {
  assert.match(html, /class="map-hotspot back-button"[^>]*href="\.\/index\.html"/);
  assert.match(html, /class="map-hotspot map-node--house"[^>]*href="\.\/reading-hut\.html"/);
  assert.match(html, /class="map-hotspot achievement-button"[^>]*href="\.\/achievement\.html"/);
});

test('renders the approved composite as a fixed phone surface', () => {
  assert.match(css, /--map-w:\s*375;/);
  assert.match(css, /--map-h:\s*812;/);
  assert.match(css, /\.level-map-page\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.map-final-art\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*fill/s);
  assert.doesNotMatch(css, /overflow-y:\s*auto/);
});

test('positions the interaction hotspots from the Lanhu source coordinates', () => {
  const expectedRules = [
    ['back-button', 15, 51, 31, 31],
    ['map-node--house', 45, 130, 185, 145],
    ['achievement-button', 292, 50, 68, 35],
  ];

  for (const [className, left, top, width, height] of expectedRules) {
    const declarations = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, 's'))?.[1] || '';
    for (const [property, value, denominator] of [
      ['left', left, 375],
      ['top', top, 812],
      ['width', width, 375],
      ['height', height, 812],
    ]) {
      assert.match(
        declarations,
        new RegExp(`${property}:\\s*calc\\(100%\\s*\\*\\s*${value}\\s*\\/\\s*${denominator}\\)`),
        `${className} ${property} should use its Lanhu source coordinate`,
      );
    }
  }
});

test('keeps keyboard focus styling on every map interaction', () => {
  assert.match(css, /\.back-button:focus-visible/);
  assert.match(css, /\.achievement-button:focus-visible/);
  assert.match(css, /\.map-node--house:focus-visible/);
});

test('does not depend on temporary design resources', () => {
  assert.doesNotMatch(`${html}\n${css}`, /figma\.com|lanhuapp\.com|assets\.lanhuapp\.com/i);
});
