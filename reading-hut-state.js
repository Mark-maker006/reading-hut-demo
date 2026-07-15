(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ReadingHutState = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const STORAGE_KEY = 'reading-hut-state-v1';

  function createDefaultState() {
    return {
      version: 1,
      stars: 30,
      items: {},
    };
  }

  function normalizeState(value) {
    const state = createDefaultState();
    if (!value || typeof value !== 'object') return state;

    const stars = Number(value.stars);
    if (Number.isFinite(stars) && stars >= 0) state.stars = Math.floor(stars);

    if (value.items && typeof value.items === 'object') {
      Object.keys(value.items).forEach(function (itemId) {
        const item = value.items[itemId];
        if (!item || typeof item !== 'object') return;
        state.items[itemId] = {
          unlocked: item.unlocked === true,
          placed: item.placed === true,
        };
      });
    }

    return state;
  }

  function getStorage(storage) {
    if (storage) return storage;
    try {
      return root.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function load(storage) {
    const target = getStorage(storage);
    if (!target) return createDefaultState();
    try {
      const value = target.getItem(STORAGE_KEY);
      return value ? normalizeState(JSON.parse(value)) : createDefaultState();
    } catch (error) {
      return createDefaultState();
    }
  }

  function save(value, storage) {
    const state = normalizeState(value);
    const target = getStorage(storage);
    if (!target) return state;
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      return state;
    }
    return state;
  }

  function purchaseItem(value, itemId, price) {
    const state = normalizeState(value);
    const cost = Number(price);
    const currentItem = state.items[itemId];

    if (currentItem && currentItem.unlocked) {
      return { ok: false, reason: 'already-unlocked', state: state };
    }
    if (!Number.isFinite(cost) || cost < 0 || state.stars < cost) {
      return { ok: false, reason: 'insufficient-stars', state: state };
    }

    state.stars -= cost;
    state.items[itemId] = { unlocked: true, placed: false };
    return { ok: true, state: state };
  }

  function placeItem(value, itemId) {
    const state = normalizeState(value);
    const item = state.items[itemId];
    if (!item || !item.unlocked) {
      return { ok: false, reason: 'locked', state: state };
    }

    item.placed = true;
    return { ok: true, state: state };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    createDefaultState: createDefaultState,
    load: load,
    save: save,
    purchaseItem: purchaseItem,
    placeItem: placeItem,
  };
});
