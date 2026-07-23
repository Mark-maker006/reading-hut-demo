const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const pages = [
  'index.html',
  'level-map.html',
  'reading-hut.html',
  'illustration-book.html',
  'achievement.html',
];
const approvedAudioFiles = [
  'entrance-enter.mp3',
  'hut-item-click.mp3',
  'map-bgm.mp3',
  'reading-hut-bgm.mp3',
  'ui-click.mp3',
];

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

test('all active pages load the shared deferred audio manager', () => {
  pages.forEach((name) => {
    assert.match(
      read(name),
      /<script src="\.\/audio-manager\.js" defer><\/script>/,
      `${name} should load the shared audio manager`,
    );
  });
});

test('runtime audio directory contains exactly the five approved English filenames', () => {
  const audioDirectory = path.join(root, 'assets', 'audio');
  assert.equal(fs.existsSync(audioDirectory), true, 'assets/audio should exist');
  assert.deepEqual(fs.readdirSync(audioDirectory).sort(), approvedAudioFiles);

  const runtimeSources = [read('audio-manager.js'), ...pages.map(read)].join('\n');
  assert.doesNotMatch(runtimeSources, /入口进入2\.mp3|地图页1\.mp3/);
});

test('pages declare the approved special effects and background tracks', () => {
  const home = read('index.html');
  const map = read('level-map.html');
  const hut = read('reading-hut.html');
  const achievement = read('achievement.html');

  assert.match(home, /class="hero-ip"[^>]*data-audio="entrance-enter"/);
  assert.match(map, /<body data-audio-bgm="map-bgm">/);
  assert.match(hut, /<body data-audio-bgm="reading-hut-bgm">/);
  assert.match(achievement, /<body data-audio-bgm="map-bgm">/);
  assert.match(hut, /class="room-action room-action-bag"[^>]*data-audio="hut-item-click"/);
  assert.match(hut, /class="room-action room-action-decorations"[^>]*data-audio="hut-item-click"/);
  assert.match(hut, /class="bag-close"[^>]*data-audio="hut-item-click"/);
  assert.match(hut, /el\.type = 'button';\s*el\.dataset\.audio = 'hut-item-click';/);
});

test('home and reading hut play each delegated click exactly once', {
  timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 394, height: 852 } });
    await installFakeAudio(context);

    const home = await context.newPage();
    const homeErrors = [];
    home.on('pageerror', (error) => homeErrors.push(error.message));
    await home.goto(pathToFileURL(path.join(root, 'index.html')).href);

    const clickedAt = await home.locator('.hero-ip').evaluate((link) => {
      const at = performance.now();
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return at;
    });
    const homeEvents = await home.evaluate(() => window.__audioEvents);

    assert.equal(homeErrors.length, 0);
    assert.equal(homeEvents.length, 1, 'special home click must not also play the generic effect');
    assert.match(homeEvents[0].src, /entrance-enter\.mp3$/);
    assert.equal(homeEvents[0].call, 1);
    assert.ok(homeEvents[0].at - clickedAt >= 0);
    assert.ok(homeEvents[0].at - clickedAt < 100);

    const hut = await context.newPage();
    const hutErrors = [];
    hut.on('pageerror', (error) => hutErrors.push(error.message));
    await hut.goto(pathToFileURL(path.join(root, 'reading-hut.html')).href);
    await hut.waitForTimeout(20);

    const background = await eventsFor(hut, 'reading-hut-bgm.mp3');
    assert.equal(background.length, 1);
    assert.equal(background[0].loop, true);
    assert.equal(background[0].volume, 0.22);

    await hut.locator('.room-action-bag').evaluate((button) => button.click());
    assert.equal((await eventsFor(hut, 'hut-item-click.mp3')).length, 1);
    assert.equal((await eventsFor(hut, 'ui-click.mp3')).length, 0);

    await hut.locator('.bag-item').first().evaluate((button) => button.click());
    assert.equal((await eventsFor(hut, 'hut-item-click.mp3')).length, 2);
    assert.equal((await eventsFor(hut, 'ui-click.mp3')).length, 0);

    await hut.locator('.exchange-cancel').first().evaluate((button) => button.click());
    assert.equal((await eventsFor(hut, 'hut-item-click.mp3')).length, 2);
    assert.equal((await eventsFor(hut, 'ui-click.mp3')).length, 1);
    assert.equal(hutErrors.length, 0);
  } finally {
    await browser.close();
  }
});

test('stopped go-plan click still plays the generic UI effect exactly once', {
  timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 394, height: 852 } });
    await installFakeAudio(context);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'reading-hut.html')).href);
    await page.evaluate(() => { window.__audioEvents.length = 0; });

    await page.locator('.exchange-go-plan').evaluate((button) => button.click());

    const clickEvents = await page.evaluate(() => window.__audioEvents);
    assert.equal(clickEvents.length, 1);
    assert.match(clickEvents[0].src, /ui-click\.mp3$/);
    assert.equal(clickEvents[0].loop, false);
    assert.equal(await page.locator('.study-tip').getAttribute('aria-hidden'), 'false');
    assert.equal(pageErrors.length, 0);
  } finally {
    await browser.close();
  }
});

test('blocked map background retries on the first interaction only', {
  timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 394, height: 852 } });
    await installFakeAudio(context);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'level-map.html')).href);
    await page.waitForTimeout(20);

    let mapEvents = await eventsFor(page, 'map-bgm.mp3');
    assert.equal(mapEvents.length, 1);
    assert.equal(mapEvents[0].loop, true);
    assert.equal(mapEvents[0].volume, 0.22);

    const pointerHandled = await page.evaluate(() => {
      let handled = false;
      document.body.addEventListener('pointerdown', () => { handled = true; }, { once: true });
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return handled;
    });
    assert.equal(pointerHandled, true, 'rejected audio must not break the original interaction');
    await page.waitForTimeout(0);

    mapEvents = await eventsFor(page, 'map-bgm.mp3');
    assert.equal(mapEvents.length, 2);
    assert.deepEqual(mapEvents.map((event) => event.loop), [true, true]);
    assert.deepEqual(mapEvents.map((event) => event.volume), [0.22, 0.22]);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(0);
    assert.equal((await eventsFor(page, 'map-bgm.mp3')).length, 2);
    assert.equal(pageErrors.length, 0);
  } finally {
    await browser.close();
  }
});

async function installFakeAudio(context) {
  await context.addInitScript(() => {
    window.__audioEvents = [];
    window.__audioPlayCalls = Object.create(null);

    class FakeAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.currentTime = 0;
      }

      play() {
        const call = (window.__audioPlayCalls[this.src] || 0) + 1;
        window.__audioPlayCalls[this.src] = call;
        window.__audioEvents.push({
          src: this.src,
          loop: this.loop,
          volume: this.volume,
          at: performance.now(),
          call,
        });
        if (this.src.endsWith('map-bgm.mp3') && call === 1) {
          return Promise.reject(new Error('autoplay blocked'));
        }
        return Promise.resolve();
      }
    }

    window.Audio = FakeAudio;
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('.hero-ip')) event.preventDefault();
    }, true);
  });
}

function eventsFor(page, suffix) {
  return page.evaluate((audioSuffix) => (
    window.__audioEvents.filter((event) => event.src.endsWith(audioSuffix))
  ), suffix);
}
