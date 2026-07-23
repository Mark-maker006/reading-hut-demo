(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.GameAudio = api;
  if (!root.document || typeof root.Audio !== 'function') return;
  const bootstrap = function () {
    root.GameAudioManager = api.createAudioManager({ document: root.document, Audio: root.Audio });
    root.GameAudioManager.start();
  };
  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const NAVIGATION_SOUND_DELAY_MS = 120;
  const AUDIO_MANIFEST = Object.freeze({
    'entrance-enter': Object.freeze({ src: './assets/audio/entrance-enter.mp3', loop: false }),
    'map-bgm': Object.freeze({ src: './assets/audio/map-bgm.mp3', loop: true, volume: 0.22 }),
    'reading-hut-bgm': Object.freeze({ src: './assets/audio/reading-hut-bgm.mp3', loop: true, volume: 0.22 }),
    'hut-item-click': Object.freeze({ src: './assets/audio/hut-item-click.mp3', loop: false }),
    'ui-click': Object.freeze({ src: './assets/audio/ui-click.mp3', loop: false }),
  });

  function resolveClickAudioName(target) {
    if (!target || typeof target.closest !== 'function') return null;
    try {
      const special = target.closest('[data-audio]');
      if (special) return special.getAttribute('data-audio') || null;
      return target.closest('button:not([disabled]), a[href]') ? 'ui-click' : null;
    } catch (error) {
      return null;
    }
  }

  function createAudioManager(options) {
    const settings = options || {};
    const document = settings.document;
    const AudioConstructor = settings.Audio;
    const manifest = settings.manifest || AUDIO_MANIFEST;
    const schedule = settings.setTimeout || setTimeout;
    const navigate = settings.navigate || function (href) {
      const location = document && document.defaultView && document.defaultView.location;
      if (location && typeof location.assign === 'function') location.assign(href);
    };
    const cache = new Map();
    const activeEffects = new Set();
    let started = false;
    let lifecycleGeneration = 0;
    let retryArmed = false;
    let pendingBackground = null;

    function createAudio(name) {
      if (!manifest[name] || typeof AudioConstructor !== 'function') return null;
      try {
        const audio = new AudioConstructor(manifest[name].src);
        audio.preload = 'auto';
        audio.loop = manifest[name].loop === true;
        if (typeof manifest[name].volume === 'number') audio.volume = manifest[name].volume;
        return audio;
      } catch (error) {
        return null;
      }
    }

    function getAudio(name) {
      if (!manifest[name] || typeof AudioConstructor !== 'function') return null;
      if (cache.has(name)) return cache.get(name);
      const audio = createAudio(name);
      if (audio) cache.set(name, audio);
      return audio;
    }

    function playAudio(audio) {
      if (!audio) return Promise.resolve(false);
      try {
        return Promise.resolve(audio.play()).then(() => true, () => false);
      } catch (error) {
        return Promise.resolve(false);
      }
    }

    function releaseEffect(audio) {
      activeEffects.delete(audio);
    }

    function playEffect(name) {
      if (!manifest[name] || manifest[name].loop) return Promise.resolve(false);
      const audio = createAudio(name);
      if (!audio) return Promise.resolve(false);
      activeEffects.add(audio);
      if (typeof audio.addEventListener === 'function') {
        audio.addEventListener('ended', () => releaseEffect(audio), { once: true });
      }
      try {
        audio.currentTime = 0;
      } catch (error) {
        // Some media implementations can reject seeking before metadata loads.
      }
      return playAudio(audio).then((played) => {
        if (!played) releaseEffect(audio);
        return played;
      });
    }

    function disarmRetry() {
      if (!retryArmed || !document || typeof document.removeEventListener !== 'function') return;
      retryArmed = false;
      document.removeEventListener('pointerdown', retryBackground);
      document.removeEventListener('keydown', retryBackground);
    }

    function retryBackground() {
      const name = pendingBackground;
      pendingBackground = null;
      disarmRetry();
      if (name) void playAudio(getAudio(name));
    }

    function armRetry() {
      if (retryArmed || !document || typeof document.addEventListener !== 'function') return;
      retryArmed = true;
      document.addEventListener('pointerdown', retryBackground);
      document.addEventListener('keydown', retryBackground);
    }

    function startBackground(name) {
      if (!manifest[name] || !manifest[name].loop) return Promise.resolve(false);
      const generation = lifecycleGeneration;
      return playAudio(getAudio(name)).then((played) => {
        if (!played && started && generation === lifecycleGeneration) {
          pendingBackground = name;
          armRetry();
        }
        return played;
      });
    }

    function getLocalNavigationHref(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return null;
      }
      if (typeof event.button === 'number' && event.button !== 0) return null;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return null;
      try {
        const link = target.closest('a[href]');
        if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return null;
        const currentHref = document && document.location && document.location.href;
        const destination = new URL(link.href, currentHref || undefined);
        if (currentHref) {
          const current = new URL(currentHref);
          if (destination.origin !== current.origin) return null;
          if (destination.pathname === current.pathname && destination.search === current.search && destination.hash) {
            return null;
          }
        }
        return destination.href;
      } catch (error) {
        return null;
      }
    }

    function handleClick(event) {
      const name = resolveClickAudioName(event && event.target);
      if (name) void playEffect(name);
      const href = name && getLocalNavigationHref(event);
      if (!href || typeof event.preventDefault !== 'function') return;
      event.preventDefault();
      schedule(() => navigate(href), NAVIGATION_SOUND_DELAY_MS);
    }

    function start() {
      if (started) return;
      started = true;
      lifecycleGeneration += 1;
      Object.keys(manifest).forEach(getAudio);
      if (document && typeof document.addEventListener === 'function') {
        document.addEventListener('click', handleClick);
      }
      const name = document && document.body && document.body.dataset && document.body.dataset.audioBgm;
      if (name) void startBackground(name);
    }

    function destroy() {
      if (!started) return;
      started = false;
      if (document && typeof document.removeEventListener === 'function') {
        document.removeEventListener('click', handleClick);
      }
      disarmRetry();
      pendingBackground = null;
    }

    return { start, destroy, playEffect, startBackground };
  }

  return { AUDIO_MANIFEST, NAVIGATION_SOUND_DELAY_MS, createAudioManager, resolveClickAudioName };
});
