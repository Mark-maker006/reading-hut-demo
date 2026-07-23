const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'reading-hut.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'reading-hut.css'), 'utf8');
const motionSource = fs.readFileSync(path.join(root, 'reading-hut-placement-motion.js'), 'utf8');

test('reading hut declares a native motion layer and versioned state script', () => {
  assert.match(html, /<script src="\.\/reading-hut-state\.js"><\/script>/);
  assert.match(html, /<script src="\.\/reading-hut-placement-motion\.js"><\/script>/);
  assert.match(html, /class="placement-motion-layer"[^>]*aria-hidden="true"/);
  assert.match(html, /class="placement-flight-path"/);
  assert.match(html, /<canvas class="placement-particle-canvas" aria-hidden="true"><\/canvas>/);
  assert.match(html, /class="placement-smoke-layer"/);
  assert.match(html, /const placementParticleCanvas = document\.querySelector\('\.placement-particle-canvas'\);/);
  assert.match(html, /particleCanvas:\s*placementParticleCanvas,/);
  assert.match(css, /\.placement-particle-canvas\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.placement-particle-canvas\s*\{[^}]*z-index:\s*2;/s);
  assert.match(html, /<link rel="preload" href="\.\/assets\/placement-smoke\.webp" as="image" type="image\/webp" \/>/);
  const smokeImageCss = css.match(/\.placement-smoke-image\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(smokeImageCss, /position:\s*absolute;/);
  assert.match(smokeImageCss, /z-index:\s*4;/);
  assert.match(smokeImageCss, /width:\s*var\(--smoke-image-size\);/);
  assert.match(smokeImageCss, /height:\s*var\(--smoke-image-size\);/);
  assert.match(smokeImageCss, /object-fit:\s*contain;/);
  assert.match(smokeImageCss, /transform:\s*translate\(-50%,\s*-50%\);/);
  assert.match(smokeImageCss, /pointer-events:\s*none;/);
  assert.match(motionSource, /startStarTrail\(options\.particleCanvas, layer, flyer\)/);
  assert.match(motionSource, /await flightAnimation\.finished;\s*stopStarTrailAnimation\(\);\s*impact\(\);/);
  assert.match(motionSource, /finally\s*\{\s*stopStarTrailAnimation\(true\);/);
  assert.match(motionSource, /smokeImage\.dispose\(\);\s*smokeLayer\.classList\.remove\('is-active'\);/);
  assert.doesNotMatch(html, /<video|furniture-flying-animation\.mp4/);
  assert.doesNotMatch(html, /href:\s*['"]\.\/placement-video\.html['"]/);
});

test('all seven items map to room placement slots', () => {
  const expectedMappings = {
    'reading-rug': 'rug',
    'wood-floor': 'floor',
    bookshelf: 'bookshelf',
    plant: 'plant',
    'star-sticker': 'star-sticker',
    doll: 'doll',
    'story-wall': 'story-wall',
  };

  Object.entries(expectedMappings).forEach(([itemId, slot]) => {
    assert.match(html, new RegExp(`id: '${itemId}'[^\\n]*slot: '${slot}'`));
    assert.match(html, new RegExp(`data-slot="${slot}"[^>]*data-item-id="${itemId}"`));
  });
});

test('wood floor placement reveals the room background instead of stretching card artwork', () => {
  const floorSlot = html.match(/<div class="placement-slot ghost-slot ghost-floor-overlay"[\s\S]*?<\/div>/)?.[0] || '';

  assert.match(floorSlot, /class="placement-ghost"[^>]*hut-ghost-floor\.svg/);
  assert.doesNotMatch(floorSlot, /placement-item|item-wood-floor-on\.png/);
  assert.match(css, /\.ghost-floor-overlay\s*>\s*\.placement-ghost\s*\{[^}]*width:\s*396px;[^}]*height:\s*512\.542px;/s);
  assert.doesNotMatch(css, /\.ghost-floor-overlay\s*>\s*img\s*\{/);
});

test('placement motion targets the measurable final room artwork', () => {
  assert.match(html, /const targetVisual = targetSlot\.querySelector\('\.placement-item'\);/);
  assert.match(html, /targetVisualElement:\s*targetVisual,/);
  assert.match(css, /\.placement-item\s*\{[^}]*visibility:\s*hidden;/s);
  assert.match(
    css,
    /\.placement-slot\.is-placed \.placement-item,[\s\S]*?\.placement-slot\.is-previewing \.placement-item\s*\{[^}]*visibility:\s*visible;/s,
  );
  assert.match(css, /\.placement-flyer\s*\{[^}]*backface-visibility:\s*visible;[^}]*transform-style:\s*preserve-3d;/s);
});

test('demo reload restores stars and clears all placement progress', {
  timeout: 30000,
}, async () => {
    const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 394, height: 852 } });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(pathToFileURL(path.join(root, 'reading-hut.html')).href);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('.room-action-bag').evaluate((button) => button.click());
    await page.waitForTimeout(450);
    await page.locator('.bag-item[data-item-id="reading-rug"]').click();
    assert.equal(await page.locator('.exchange-overlay').getAttribute('aria-hidden'), 'false');
    assert.equal(await page.locator('.exchange-dialog').getAttribute('data-mode'), 'sufficient');
    await page.locator('.exchange-confirm').click();

    const purchasedState = await page.evaluate(() => JSON.parse(localStorage.getItem('reading-hut-state-v1')));
    assert.equal(purchasedState.stars, 490);
    assert.deepEqual(purchasedState.items['reading-rug'], { unlocked: true, placed: false });

    await page.locator('.bag-item[data-item-id="reading-rug"]').click();
    assert.equal(await page.locator('.placement-motion-layer').getAttribute('aria-hidden'), 'false');
    assert.equal(await page.locator('.placement-flyer').count(), 1);
    await page.locator('[data-slot="rug"]').waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('[data-slot="rug"]')?.classList.contains('is-placed'));

    assert.equal(await page.locator('.placement-motion-layer').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.bag-item[data-item-id="reading-rug"]').count(), 0);
    assert.match(await page.locator('[data-slot="rug"]').getAttribute('class'), /is-placed/);
    assert.notEqual(await page.locator('[data-slot="rug"] .placement-item').evaluate((node) => getComputedStyle(node).display), 'none');

    const placedState = await page.evaluate(() => JSON.parse(localStorage.getItem('reading-hut-state-v1')));
    assert.equal(placedState.items['reading-rug'].placed, true);

    await page.reload();
    assert.equal(await page.locator('.room-star-count').textContent(), '500');
    assert.doesNotMatch(await page.locator('[data-slot="rug"]').getAttribute('class'), /is-placed/);
    await page.locator('.room-action-bag').evaluate((button) => button.click());
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.bag-item[data-item-id="reading-rug"]').count(), 1);
    assert.equal(await page.locator('.bag-item[data-item-id="reading-rug"]').getAttribute('data-state'), 'off');
  } finally {
    await browser.close();
  }
});
