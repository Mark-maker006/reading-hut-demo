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

test('keeps the provided map artwork at its source dimensions', () => {
  assert.deepEqual(readPngDimensions('map-house.png'), { width: 254, height: 223 });
  assert.deepEqual(readPngDimensions('map-base.png'), { width: 852, height: 1846 });
});

test('renders the exact Figma map-node inventory from local map assets', () => {
  assert.equal(occurrences(html, /class="[^"]*map-node--start(?:\s|\")/g), 1);
  assert.equal(occurrences(html, /class="[^"]*map-node--house(?:\s|\")/g), 1);
  assert.equal(occurrences(html, /class="[^"]*map-node--reward(?:\s|\")/g), 1);
  assert.equal(occurrences(html, /class="[^"]*map-node--flag(?:\s|\")/g), 1);
  assert.equal(occurrences(html, /class="[^"]*map-node--locked(?:\s|\")/g), 4);
  assert.match(html, /assets\/map-start\.png/);
  assert.match(html, /assets\/map-house\.png/);
  assert.match(html, /assets\/map-star-award\.png/);
  assert.match(html, /assets\/map-flag\.png/);
  assert.match(html, /assets\/map-house-locked\.png/);
});

test('keeps the three specified navigation targets', () => {
  assert.match(html, /href="\.\/index\.html"/);
  assert.match(html, /href="\.\/reading-hut\.html"/);
  assert.match(html, /href="\.\/achievement\.html"/);
});

test('uses the 784 by 2303 responsive map canvas and a vertical scroll viewport', () => {
  assert.match(css, /\.map-canvas\s*\{[^}]*aspect-ratio:\s*784\s*\/\s*2303/s);
  assert.match(css, /\.map-scroll\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.map-scroll\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.map-art\s*\{[^}]*object-fit:\s*fill/s);
});

test('maps the Figma node coordinates to percentages of the map canvas', () => {
  const expectedRules = [
    ['map-node--start', '99.5 / 784', '157 / 2303', '69 / 784', '108 / 2303'],
    ['map-node--house', '92 / 784', '265 / 2303', '254 / 784', '223 / 2303'],
    ['map-node--flag', '528 / 784', '463 / 2303', '45 / 784', '69 / 2303'],
    ['map-node--reward', '480 / 784', '531 / 2303', '76 / 784', '71 / 2303'],
  ];

  for (const [className, left, top, width, height] of expectedRules) {
    const declarations = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, 's'))?.[1] || '';
    for (const [property, expression] of [['left', left], ['top', top], ['width', width], ['height', height]]) {
      const [numerator, denominator] = expression.split(' / ');
      assert.match(
        declarations,
        new RegExp(`${property}:\\s*calc\\(100%\\s*\\*\\s*${numerator}\\s*\\/\\s*${denominator}\\)`),
        `${className} ${property} should use its Figma value`,
      );
    }
  }

  assert.match(css, /\.map-node--locked-1\s*\{[^}]*--x:\s*206;[^}]*--y:\s*575;/s);
  assert.match(css, /\.map-node--locked-2\s*\{[^}]*--x:\s*412;[^}]*--y:\s*875;/s);
  assert.match(css, /\.map-node--locked-3\s*\{[^}]*--x:\s*206;[^}]*--y:\s*1127;/s);
  assert.match(css, /\.map-node--locked-4\s*\{[^}]*--x:\s*440;[^}]*--y:\s*1404;/s);
});

test('pins the Figma top controls and Coming Soon artwork above the scrolling map', () => {
  assert.match(html, /class="map-ui"/);
  assert.match(html, /class="coming-button"[^>]*src="\.\/assets\/map-coming-button\.png"/);
  assert.match(css, /\.level-map-page\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.map-ui\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.coming-button\s*\{[^}]*position:\s*absolute/s);
  assert.doesNotMatch(css, /@keyframes\s+nodeGlow/);
});

test('does not depend on temporary Figma resources', () => {
  assert.doesNotMatch(`${html}\n${css}`, /figma\.com/i);
});
