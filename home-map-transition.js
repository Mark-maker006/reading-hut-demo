(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.HomeMapTransition = api;
  const document = root.document;
  if (!document) return;

  function bootstrap() {
    api.bootstrapHomeMapTransition({ document: document });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const STORAGE_KEY = 'home-map-transition-v1';
  const TIMING = Object.freeze({
    scatterDuration: 650,
    heroFadeDuration: 1000,
    mapRevealStart: 260,
    cloudStart: 520,
    settleStart: 1250,
    navigateAt: 1500,
    reducedNavigateAt: 180,
  });

  function centerOf(rect) {
    return {
      x: Number(rect.left) + Number(rect.width) / 2,
      y: Number(rect.top) + Number(rect.height) / 2,
    };
  }

  function computeScatterVector(originRect, targetRect, viewport) {
    const origin = centerOf(originRect);
    const target = centerOf(targetRect);
    let deltaX = target.x - origin.x;
    let deltaY = target.y - origin.y;
    let length = Math.hypot(deltaX, deltaY);

    if (length === 0 && viewport) {
      const viewportLeft = Number(viewport.left);
      const viewportTop = Number(viewport.top);
      deltaX = target.x
        - (Number.isFinite(viewportLeft) ? viewportLeft : 0)
        - Number(viewport.width) / 2;
      deltaY = target.y
        - (Number.isFinite(viewportTop) ? viewportTop : 0)
        - Number(viewport.height) / 2;
      length = Math.hypot(deltaX, deltaY);
    }

    if (length === 0) {
      deltaX = 0;
      deltaY = -1;
      length = 1;
    }

    const x = deltaX / length;
    const y = deltaY / length;
    return {
      x: x,
      y: y,
      rotate: x * 8,
    };
  }

  function computeScatterDistance(targetRect, viewport, vector, margin) {
    const exitMargin = margin === undefined ? 24 : Number(margin);
    const left = Number(targetRect.left);
    const top = Number(targetRect.top);
    const width = Number(targetRect.width);
    const height = Number(targetRect.height);
    const explicitRight = Number(targetRect.right);
    const explicitBottom = Number(targetRect.bottom);
    const right = Number.isFinite(explicitRight) ? explicitRight : left + width;
    const bottom = Number.isFinite(explicitBottom) ? explicitBottom : top + height;
    const x = Number(vector.x);
    const y = Number(vector.y);
    const candidates = [];

    if (x < 0) candidates.push(Math.max(0, (right + exitMargin) / -x));
    if (x > 0) candidates.push(Math.max(0, (Number(viewport.width) + exitMargin - left) / x));
    if (y < 0) candidates.push(Math.max(0, (bottom + exitMargin) / -y));
    if (y > 0) candidates.push(Math.max(0, (Number(viewport.height) + exitMargin - top) / y));

    return candidates.length > 0 ? Math.min.apply(Math, candidates) : 0;
  }

  function defaultScheduler() {
    return {
      setTimeout: root.setTimeout.bind(root),
      clearTimeout: root.clearTimeout.bind(root),
    };
  }

  function defaultStorage() {
    try {
      return root.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function defaultNavigate(destination) {
    if (root.location && typeof root.location.assign === 'function') {
      root.location.assign(destination);
    }
  }

  function createTransitionController(options) {
    const settings = options || {};
    const scheduler = settings.scheduler || defaultScheduler();
    const storage = Object.prototype.hasOwnProperty.call(settings, 'storage')
      ? settings.storage
      : defaultStorage();
    const navigate = settings.navigate || defaultNavigate;
    const onStateChange = settings.onStateChange || function () {};
    const destination = settings.destination;
    const reducedMotion = settings.reducedMotion === true;
    const timerIds = new Set();
    let state = 'idle';
    let started = false;
    let disposed = false;
    let navigated = false;
    let markerPending = false;

    function changeState(nextState) {
      state = nextState;
      onStateChange(nextState);
    }

    function schedule(callback, delay) {
      let timerId;
      timerId = scheduler.setTimeout(function () {
        timerIds.delete(timerId);
        if (!disposed) callback();
      }, delay);
      timerIds.add(timerId);
    }

    function navigateOnce() {
      if (navigated || disposed) return;
      changeState('navigating');
      if (disposed) return;
      navigated = true;
      navigate(destination);
    }

    function start() {
      if (started || disposed) return false;
      started = true;

      if (storage && typeof storage.setItem === 'function') {
        try {
          storage.setItem(STORAGE_KEY, 'pending');
          markerPending = true;
        } catch (error) {
          // Storage availability must not block the transition.
        }
      }

      changeState('scattering');
      if (disposed) return true;

      if (reducedMotion) {
        schedule(navigateOnce, TIMING.reducedNavigateAt);
        return true;
      }

      schedule(function () {
        changeState('map-revealing');
      }, TIMING.mapRevealStart);
      schedule(function () {
        changeState('cloud-covering');
      }, TIMING.cloudStart);
      schedule(function () {
        changeState('settling');
      }, TIMING.settleStart);
      schedule(navigateOnce, TIMING.navigateAt);
      return true;
    }

    function getState() {
      return state;
    }

    function dispose() {
      disposed = true;
      timerIds.forEach(function (timerId) {
        scheduler.clearTimeout(timerId);
      });
      timerIds.clear();

      if (!navigated && markerPending && storage && typeof storage.removeItem === 'function') {
        try {
          storage.removeItem(STORAGE_KEY);
          markerPending = false;
        } catch (error) {
          // Storage availability must not block disposal.
        }
      }
    }

    return {
      start: start,
      getState: getState,
      dispose: dispose,
    };
  }

  function bootstrapHomeMapTransition(options) {
    const settings = options || {};
    const document = settings.document;
    if (!document || typeof document.querySelector !== 'function') return null;

    const link = document.querySelector('.hero-ip');
    const ipArt = document.querySelector('.hero-ip-art');
    const stage = document.querySelector('.home-map-transition');
    const pieces = Array.from(document.querySelectorAll('[data-home-transition-piece]'));
    if (!link || !ipArt || !stage || pieces.length === 0) return null;

    const documentElement = document.documentElement;
    const body = document.body;
    const destination = link.getAttribute('href');
    const scheduler = settings.scheduler || defaultScheduler();
    const pageEventTarget = settings.window || root;
    const preloadedImages = [];
    let disposed = false;
    let pageHidden = false;
    let controller = null;

    function markPreloadError() {
      if (!disposed) stage.classList.add('has-preload-error');
    }

    function clearPreloadedImages() {
      preloadedImages.forEach(function (image) {
        image.onerror = null;
      });
      preloadedImages.length = 0;
    }

    function preloadStageImages() {
      clearPreloadedImages();
      const ImageConstructor = Object.prototype.hasOwnProperty.call(settings, 'Image')
        ? settings.Image
        : root.Image;
      if (typeof ImageConstructor !== 'function' || typeof stage.querySelectorAll !== 'function') {
        markPreloadError();
        return;
      }

      const sources = new Set();
      Array.from(stage.querySelectorAll('img')).forEach(function (image) {
        const source = typeof image.getAttribute === 'function'
          ? image.getAttribute('src')
          : image.src;
        if (source) sources.add(source);
      });

      sources.forEach(function (source) {
        try {
          const image = new ImageConstructor();
          image.onerror = markPreloadError;
          preloadedImages.push(image);
          image.src = source;
        } catch (error) {
          markPreloadError();
        }
      });
    }

    function viewportSize() {
      const stageRect = stage.getBoundingClientRect();
      const stageLeft = Number(stageRect.left);
      const stageTop = Number(stageRect.top);
      const width = Number(stageRect.width)
        || Number(documentElement && documentElement.clientWidth)
        || Number(root.innerWidth)
        || 393;
      const height = Number(stageRect.height)
        || Number(documentElement && documentElement.clientHeight)
        || Number(root.innerHeight)
        || 852;
      return {
        left: Number.isFinite(stageLeft) ? stageLeft : 0,
        top: Number.isFinite(stageTop) ? stageTop : 0,
        width: width,
        height: height,
      };
    }

    function setScatterStyles() {
      const originRect = ipArt.getBoundingClientRect();
      const viewport = viewportSize();

      pieces.forEach(function (piece) {
        const pieceRect = piece.getBoundingClientRect();
        const vector = computeScatterVector(originRect, pieceRect, viewport);
        const localLeft = Number(pieceRect.left) - viewport.left;
        const localTop = Number(pieceRect.top) - viewport.top;
        const pieceWidth = Number(pieceRect.width);
        const pieceHeight = Number(pieceRect.height);
        const localPieceRect = {
          left: localLeft,
          top: localTop,
          width: pieceWidth,
          height: pieceHeight,
          right: localLeft + pieceWidth,
          bottom: localTop + pieceHeight,
        };
        const distance = computeScatterDistance(localPieceRect, viewport, vector);
        piece.style.setProperty('--scatter-x', (vector.x * distance).toFixed(2) + 'px');
        piece.style.setProperty('--scatter-y', (vector.y * distance).toFixed(2) + 'px');
        piece.style.setProperty('--scatter-rotate', vector.rotate.toFixed(2) + 'deg');
      });
    }

    function lockLink() {
      link.setAttribute('aria-disabled', 'true');
      link.style.pointerEvents = 'none';
    }

    function unlockLink() {
      link.removeAttribute('aria-disabled');
      link.style.pointerEvents = '';
    }

    function removeTransitionClasses() {
      if (documentElement) {
        documentElement.classList.remove('home-transitioning', 'home-map-revealing');
      }
      if (body) body.classList.remove('home-transitioning', 'home-map-revealing');
      stage.classList.remove(
        'is-active',
        'is-map-revealing',
        'clouds-in',
        'is-settling',
        'is-navigating',
        'has-preload-error',
      );
    }

    function removeScatterStyles() {
      pieces.forEach(function (piece) {
        piece.style.removeProperty('--scatter-x');
        piece.style.removeProperty('--scatter-y');
        piece.style.removeProperty('--scatter-rotate');
      });
    }

    function clearVisualState() {
      unlockLink();
      removeTransitionClasses();
      removeScatterStyles();
    }

    function handleStateChange(state) {
      if (state === 'scattering') {
        lockLink();
        if (documentElement) documentElement.classList.add('home-transitioning');
        if (body) body.classList.add('home-transitioning');
        stage.classList.add('is-active');
      } else if (state === 'map-revealing') {
        if (documentElement) documentElement.classList.add('home-map-revealing');
        if (body) body.classList.add('home-map-revealing');
        stage.classList.add('is-map-revealing');
      } else if (state === 'cloud-covering') {
        stage.classList.add('clouds-in');
      } else if (state === 'settling') {
        stage.classList.add('is-settling');
      } else if (state === 'navigating') {
        stage.classList.add('is-navigating');
      }
    }

    const mediaMatcher = settings.matchMedia || pageEventTarget.matchMedia || root.matchMedia;
    const reducedMotion = typeof mediaMatcher === 'function'
      ? mediaMatcher.call(pageEventTarget, '(prefers-reduced-motion: reduce)').matches
      : false;
    const controllerOptions = {
      scheduler: scheduler,
      destination: destination,
      reducedMotion: reducedMotion,
      navigate: settings.navigate || defaultNavigate,
      onStateChange: handleStateChange,
    };
    if (Object.prototype.hasOwnProperty.call(settings, 'storage')) {
      controllerOptions.storage = settings.storage;
    }

    function createFreshController() {
      controller = createTransitionController(controllerOptions);
    }

    function disposeController() {
      if (!controller) return;
      controller.dispose();
      controller = null;
    }

    function start() {
      if (disposed || pageHidden) return false;
      if (!controller) createFreshController();
      if (controller.getState() !== 'idle') return false;
      setScatterStyles();
      return controller.start();
    }

    function getState() {
      return controller ? controller.getState() : 'idle';
    }

    function handleClick(event) {
      event.preventDefault();
      start();
    }

    function handlePageHide() {
      pageHidden = true;
      disposeController();
      clearVisualState();
      clearPreloadedImages();
    }

    function handlePageShow() {
      if (disposed) return;
      pageHidden = false;
      disposeController();
      clearVisualState();
      preloadStageImages();
      createFreshController();
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      link.removeEventListener('click', handleClick);
      if (pageEventTarget && typeof pageEventTarget.removeEventListener === 'function') {
        pageEventTarget.removeEventListener('pagehide', handlePageHide);
        pageEventTarget.removeEventListener('pageshow', handlePageShow);
      }
      disposeController();
      clearVisualState();
      clearPreloadedImages();
    }

    preloadStageImages();
    createFreshController();
    link.addEventListener('click', handleClick);
    if (pageEventTarget && typeof pageEventTarget.addEventListener === 'function') {
      pageEventTarget.addEventListener('pagehide', handlePageHide);
      pageEventTarget.addEventListener('pageshow', handlePageShow);
    }

    return {
      start: start,
      getState: getState,
      dispose: dispose,
    };
  }

  return {
    TIMING: TIMING,
    bootstrapHomeMapTransition: bootstrapHomeMapTransition,
    computeScatterDistance: computeScatterDistance,
    computeScatterVector: computeScatterVector,
    createTransitionController: createTransitionController,
  };
});
