(function initMapEntryTransition(root, factory) {
  const api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  try {
    api.consumeMapEntryTransition();
  } catch (_error) {
    // Entry handoff decoration must never prevent the map from loading.
  }
})(typeof window !== 'undefined' ? window : null, function createMapEntryTransition(root) {
  const STORAGE_KEY = 'home-map-transition-v1';
  const ENTRY_CLASS = 'map-entering-from-home';

  function consumeMapEntryTransition(options) {
    const settings = options || {};
    let documentRef;
    let storage;

    try {
      documentRef = Object.prototype.hasOwnProperty.call(settings, 'document')
        ? settings.document
        : root && root.document;
      storage = Object.prototype.hasOwnProperty.call(settings, 'storage')
        ? settings.storage
        : root && root.sessionStorage;
    } catch (_error) {
      return false;
    }

    try {
      if (!storage || storage.getItem(STORAGE_KEY) !== 'pending') return false;
    } catch (_error) {
      return false;
    }

    let classList;
    try {
      classList = documentRef.documentElement.classList;
      classList.add(ENTRY_CLASS);
    } catch (_error) {
      return false;
    }

    try {
      storage.removeItem(STORAGE_KEY);
    } catch (_error) {
      try {
        classList.remove(ENTRY_CLASS);
      } catch (_rollbackError) {
        // Rollback is best-effort and must not prevent the map from loading.
      }
      return false;
    }

    return true;
  }

  return { consumeMapEntryTransition };
});
