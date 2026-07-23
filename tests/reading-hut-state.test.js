const test = require('node:test');
const assert = require('node:assert/strict');

const stateApiPath = require.resolve('../reading-hut-state.js');

test('default state is versioned with the initial star balance', () => {
  const { STORAGE_KEY, createDefaultState } = require(stateApiPath);
  assert.equal(STORAGE_KEY, 'reading-hut-state-v1');
  assert.deepEqual(createDefaultState(), {
    version: 1,
    stars: 500,
    items: {},
  });
});

test('purchase atomically deducts stars and unlocks the requested item', () => {
  const { createDefaultState, purchaseItem } = require(stateApiPath);
  const before = createDefaultState();
  const result = purchaseItem(before, 'reading-rug', 10);

  assert.equal(result.ok, true);
  assert.deepEqual(result.state, {
    version: 1,
    stars: 490,
    items: {
      'reading-rug': { unlocked: true, placed: false },
    },
  });
  assert.deepEqual(before, createDefaultState());
});

test('purchase rejects an unaffordable item without changing state', () => {
  const { createDefaultState, purchaseItem } = require(stateApiPath);
  const before = { ...createDefaultState(), stars: 30 };
  const result = purchaseItem(before, 'bookshelf', 45);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient-stars');
  assert.deepEqual(result.state, before);
});

test('only an unlocked item can be placed', () => {
  const { createDefaultState, purchaseItem, placeItem } = require(stateApiPath);
  const lockedResult = placeItem(createDefaultState(), 'plant');
  assert.equal(lockedResult.ok, false);
  assert.equal(lockedResult.reason, 'locked');

  const unlocked = purchaseItem(createDefaultState(), 'plant', 10).state;
  const placedResult = placeItem(unlocked, 'plant');
  assert.equal(placedResult.ok, true);
  assert.deepEqual(placedResult.state.items.plant, {
    unlocked: true,
    placed: true,
  });
});

test('load recovers from malformed storage and save writes normalized state', () => {
  const { STORAGE_KEY, load, save } = require(stateApiPath);
  let storedValue = '{broken json';
  const storage = {
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return storedValue;
    },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      storedValue = value;
    },
  };

  assert.equal(load(storage).stars, 500);
  const saved = save({ version: 99, stars: 12, items: { plant: { unlocked: true } } }, storage);
  assert.deepEqual(saved, {
    version: 1,
    stars: 12,
    items: { plant: { unlocked: true, placed: false } },
  });
  assert.deepEqual(JSON.parse(storedValue), saved);
});
