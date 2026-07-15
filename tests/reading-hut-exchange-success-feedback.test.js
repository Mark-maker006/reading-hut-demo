const test = require('node:test');
const assert = require('node:assert/strict');

const { promoteItemById } = require('../reading-hut-exchange.js');

test('promoteItemById moves only the redeemed item to the front', () => {
  const items = [{ id: 'rug' }, { id: 'floor' }, { id: 'shelf' }];

  assert.deepEqual(promoteItemById(items, 'shelf').map((item) => item.id), [
    'shelf',
    'rug',
    'floor',
  ]);
  assert.deepEqual(items.map((item) => item.id), ['rug', 'floor', 'shelf']);
});
