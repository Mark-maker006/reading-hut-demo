const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AUDIO_MANIFEST,
  createAudioManager,
  resolveClickAudioName,
} = require('../audio-manager.js');

test('manifest contains only approved files and loop flags', () => {
  assert.deepEqual(AUDIO_MANIFEST, {
    'entrance-enter': { src: './assets/audio/entrance-enter.mp3', loop: false },
    'map-bgm': { src: './assets/audio/map-bgm.mp3', loop: true, volume: 0.22 },
    'reading-hut-bgm': { src: './assets/audio/reading-hut-bgm.mp3', loop: true, volume: 0.22 },
    'hut-item-click': { src: './assets/audio/hut-item-click.mp3', loop: false },
    'ui-click': { src: './assets/audio/ui-click.mp3', loop: false },
  });
});

test('special audio wins over generic controls', () => {
  const special = { getAttribute: () => 'hut-item-click' };
  const target = {
    closest: (selector) => selector === '[data-audio]' ? special : {},
  };
  assert.equal(resolveClickAudioName(target), 'hut-item-click');
});

test('generic matching includes enabled controls and ignores non-controls', () => {
  assert.equal(
    resolveClickAudioName({ closest: (selector) => selector.includes('button:not') ? {} : null }),
    'ui-click',
  );
  assert.equal(resolveClickAudioName({ closest: () => null }), null);
  assert.equal(resolveClickAudioName(null), null);
});

test('start preloads every manifest audio and is idempotent', () => {
  const { document, listenerCount } = createFakeDocument();
  const audio = createFakeAudio();
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  manager.start();

  assert.equal(audio.instances.length, Object.keys(AUDIO_MANIFEST).length);
  for (const instance of audio.instances) {
    assert.equal(instance.preload, 'auto');
    assert.equal(instance.loop, AUDIO_MANIFEST[Object.keys(AUDIO_MANIFEST).find((name) => instance.src.endsWith(AUDIO_MANIFEST[name].src.slice(1)))].loop);
  }
  assert.equal(listenerCount('click'), 1);
});

test('two rapid special clicks create two independent effects', async () => {
  const { document, dispatch } = createFakeDocument();
  const audio = createFakeAudio();
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  dispatch('click', createTarget('hut-item-click', true));
  dispatch('click', createTarget('hut-item-click', true));
  await flushPromises();

  const effects = audio.instances.filter(
    (instance) => instance.src.endsWith('hut-item-click.mp3') && instance.playCalls > 0,
  );
  assert.equal(effects.length, 2);
  assert.deepEqual(effects.map((instance) => instance.playCalls), [1, 1]);
  assert.equal(audio.find('ui-click.mp3').playCalls, 0);
});

test('background music stays low and click effects overlap without interrupting it', async () => {
  const { document, dispatch } = createFakeDocument('map-bgm');
  const audio = createFakeAudio();
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  dispatch('click', createTarget('ui-click', true));
  dispatch('click', createTarget('ui-click', true));
  await flushPromises();

  const background = audio.find('map-bgm.mp3');
  const effects = audio.instances.filter(
    (instance) => instance.src.endsWith('ui-click.mp3') && instance.playCalls > 0,
  );
  assert.equal(background.volume, 0.22);
  assert.equal(background.playCalls, 1);
  assert.equal(effects.length, 2);
  assert.deepEqual(effects.map((instance) => instance.playCalls), [1, 1]);
});

test('UI click effects keep native media output instead of routing through Web Audio', async () => {
  const { document, dispatch } = createFakeDocument('map-bgm');
  const audio = createFakeAudio();
  const webAudio = createFakeAudioContext();
  const manager = createAudioManager({
    document,
    Audio: audio.Audio,
    AudioContext: webAudio.AudioContext,
  });
  manager.start();
  dispatch('click', createTarget('hut-item-click', true));
  dispatch('click', createTarget('ui-click', true));
  await flushPromises();

  assert.equal(webAudio.gains.length, 0);
  assert.equal(webAudio.sources.length, 0);
  assert.equal(audio.find('hut-item-click.mp3').playCalls, 1);
  assert.equal(audio.find('ui-click.mp3').playCalls, 1);
  assert.equal(audio.find('map-bgm.mp3').volume, 0.22);
  assert.equal(webAudio.resumeCalls, 0);
});

test('generic control click plays ui-click and never loops a short effect', async () => {
  const { document, dispatch } = createFakeDocument();
  const audio = createFakeAudio();
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  dispatch('click', createTarget(null, true));
  await flushPromises();

  assert.equal(audio.find('ui-click.mp3').playCalls, 1);
  assert.equal(audio.find('ui-click.mp3').loop, false);
  assert.equal(audio.find('map-bgm.mp3').playCalls, 0);
});

test('plain local navigation waits briefly after starting its click effect', async () => {
  const timers = [];
  const navigations = [];
  const { document, dispatchEvent } = createFakeDocument();
  const audio = createFakeAudio();
  const manager = createAudioManager({
    document,
    Audio: audio.Audio,
    navigate(href) {
      navigations.push(href);
    },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  manager.start();

  const link = {
    href: 'https://game.test/level-map.html',
    target: '',
    hasAttribute: () => false,
  };
  const target = {
    closest(selector) {
      if (selector === '[data-audio]') return null;
      if (selector === 'button:not([disabled]), a[href]') return link;
      if (selector === 'a[href]') return link;
      return null;
    },
  };
  const event = {
    target,
    button: 0,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };

  dispatchEvent('click', event);
  await flushPromises();

  assert.equal(audio.find('ui-click.mp3').playCalls, 1);
  assert.equal(event.defaultPrevented, true);
  assert.equal(navigations.length, 0);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 120);
  timers[0].callback();
  assert.deepEqual(navigations, ['https://game.test/level-map.html']);
});

test('blocked BGM retries on the first pointer or keyboard interaction only', async () => {
  const { document, dispatch, listenerCount } = createFakeDocument('map-bgm');
  const audio = createFakeAudio('map-bgm.mp3');
  createAudioManager({ document, Audio: audio.Audio }).start();
  await flushPromises();

  assert.equal(audio.find('map-bgm.mp3').playCalls, 1);
  assert.equal(audio.find('map-bgm.mp3').loop, true);
  dispatch('pointerdown', createTarget(null, false));
  await flushPromises();
  dispatch('keydown', createTarget(null, false));
  await flushPromises();
  assert.equal(audio.find('map-bgm.mp3').playCalls, 2);
  assert.equal(listenerCount('pointerdown') + listenerCount('keydown'), 0);
});

test('blocked BGM can retry from the keyboard when it is the first interaction', async () => {
  const { document, dispatch, listenerCount } = createFakeDocument('map-bgm');
  const audio = createFakeAudio('map-bgm.mp3');
  createAudioManager({ document, Audio: audio.Audio }).start();
  await flushPromises();
  dispatch('keydown', createTarget(null, false));
  await flushPromises();

  assert.equal(audio.find('map-bgm.mp3').playCalls, 2);
  assert.equal(listenerCount('pointerdown') + listenerCount('keydown'), 0);
});

test('play throws or rejects without causing unhandled rejections', async () => {
  const { document, dispatch } = createFakeDocument();
  const audio = createFakeAudio();
  audio.throwOnPlay = true;
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  dispatch('click', createTarget('ui-click', true));
  await flushPromises();
  assert.equal(audio.find('ui-click.mp3').playCalls, 1);
});

test('destroy prevents a pending blocked BGM from rearming retry listeners', async () => {
  const { document, listenerCount } = createFakeDocument('map-bgm');
  const audio = createFakeAudio('map-bgm.mp3');
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  manager.destroy();
  await flushPromises();

  assert.equal(listenerCount('pointerdown'), 0);
  assert.equal(listenerCount('keydown'), 0);
});

test('a rejected BGM from an old start cannot arm retry after restart', async () => {
  const { document, dispatch, listenerCount } = createFakeDocument('map-bgm');
  const audio = createFakeAudio('map-bgm.mp3', { deferFirstRejection: true });
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  manager.destroy();
  manager.start();
  await flushPromises();
  assert.equal(audio.find('map-bgm.mp3').playCalls, 2);

  audio.rejectBlocked();
  await flushPromises();
  assert.equal(listenerCount('pointerdown') + listenerCount('keydown'), 0);
  dispatch('pointerdown', createTarget(null, false));
  await flushPromises();
  assert.equal(audio.find('map-bgm.mp3').playCalls, 2);
});

test('destroy removes click and retry listeners', async () => {
  const { document, listenerCount } = createFakeDocument('map-bgm');
  const audio = createFakeAudio('map-bgm.mp3');
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  await flushPromises();
  assert.equal(listenerCount('click'), 1);
  assert.equal(listenerCount('pointerdown'), 1);
  assert.equal(listenerCount('keydown'), 1);
  manager.destroy();
  manager.destroy();
  assert.equal(listenerCount('click'), 0);
  assert.equal(listenerCount('pointerdown'), 0);
  assert.equal(listenerCount('keydown'), 0);
});

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

function createTarget(name, interactive) {
  const special = name ? {
    getAttribute(attribute) {
      return attribute === 'data-audio' ? name : null;
    },
  } : null;
  const generic = interactive ? {} : null;
  return {
    closest(selector) {
      if (selector === '[data-audio]') return special;
      if (selector === 'button:not([disabled]), a[href]') return generic;
      return null;
    },
  };
}

function createFakeDocument(audioBgm) {
  const listeners = new Map();
  const document = {
    location: { href: 'https://game.test/achievement.html' },
    body: { dataset: audioBgm ? { audioBgm } : {} },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };
  return {
    document,
    dispatch(type, target) {
      Array.from(listeners.get(type) || []).forEach((listener) => listener({ target }));
    },
    dispatchEvent(type, event) {
      Array.from(listeners.get(type) || []).forEach((listener) => listener(event));
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

function createFakeAudio(blockedSuffix, options = {}) {
  const instances = [];
  const controller = { rejectBlocked: null, throwOnPlay: false };
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.loop = false;
      this.volume = 1;
      this.preload = '';
      this.currentTime = -1;
      this.playCalls = 0;
      instances.push(this);
    }
    play() {
      this.playCalls += 1;
      if (controller.throwOnPlay) throw new Error('play failed');
      if (blockedSuffix && this.src.endsWith(blockedSuffix) && this.playCalls === 1) {
        if (options.deferFirstRejection) {
          return new Promise((resolve, reject) => {
            controller.rejectBlocked = () => reject(new Error('autoplay blocked'));
          });
        }
        return Promise.reject(new Error('autoplay blocked'));
      }
      return Promise.resolve();
    }
  }
  return {
    Audio: FakeAudio,
    instances,
    get throwOnPlay() {
      return controller.throwOnPlay;
    },
    set throwOnPlay(value) {
      controller.throwOnPlay = value;
    },
    rejectBlocked() {
      controller.rejectBlocked();
    },
    find(suffix) {
      return instances.find((instance) => instance.src.endsWith(suffix) && instance.playCalls > 0)
        || instances.find((instance) => instance.src.endsWith(suffix));
    },
  };
}

function createFakeAudioContext() {
  const controller = { resumeCalls: 0 };
  const sources = [];
  const gains = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.destination = {};
    }
    createMediaElementSource(audio) {
      const node = {
        audio,
        connect() {},
        disconnect() {},
      };
      sources.push(node);
      return node;
    }
    createGain() {
      const node = {
        gain: { value: 1 },
        connect() {},
        disconnect() {},
      };
      gains.push(node);
      return node;
    }
    resume() {
      controller.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    }
  }

  return {
    AudioContext: FakeAudioContext,
    sources,
    gains,
    get resumeCalls() {
      return controller.resumeCalls;
    },
  };
}
