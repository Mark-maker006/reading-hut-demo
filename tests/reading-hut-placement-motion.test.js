const test = require('node:test');
const assert = require('node:assert/strict');

const motion = require('../reading-hut-placement-motion.js');

test('flight geometry follows a four-keyframe curved path to the target slot', () => {
  const geometry = motion.createFlightGeometry(
    { left: 10, top: 20, width: 20, height: 40 },
    { left: 210, top: 320, width: 40, height: 80 },
  );

  assert.equal(geometry.keyframes.length, 4);
  assert.deepEqual(geometry.keyframes.map((frame) => frame.offset), [0, 0.32, 0.68, 1]);
  assert.match(geometry.path, /^M 20 40 C /);
  assert.match(geometry.path, / 230 360$/);
  assert.equal(
    geometry.keyframes.at(-1).transform,
    'translate3d(200px, 300px, 0) scale(2, 2) rotate(0deg)',
  );
});

test('motion timing and smoke layout are deterministic and reusable', () => {
  assert.equal(motion.FLIGHT_DURATION_MS, 900);
  assert.equal(motion.SMOKE_DURATION_MS, 1050);
  assert.equal(motion.TOTAL_DURATION_MS, 2200);
  assert.equal(motion.SMOKE_PUFFS.length, 9);
  assert.deepEqual(motion.SMOKE_PUFFS[0], { x: 0, y: 0, size: 0.72, delay: 0 });
  assert.ok(motion.SMOKE_PUFFS.some((puff) => puff.x < 0));
  assert.ok(motion.SMOKE_PUFFS.some((puff) => puff.x > 0));
});
