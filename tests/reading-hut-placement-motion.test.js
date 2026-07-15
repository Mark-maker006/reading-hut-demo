const test = require('node:test');
const assert = require('node:assert/strict');

const motion = require('../reading-hut-placement-motion.js');

test('detects horizontal mirroring from independent scale and transform matrices', () => {
  assert.equal(motion.isHorizontallyMirrored('none', '-1 1'), true);
  assert.equal(motion.isHorizontallyMirrored('matrix(-1, 0, 0, 1, 0, 0)', 'none'), true);
  assert.equal(motion.isHorizontallyMirrored('matrix(1, 0, 0, 1, 0, 0)', 'none'), false);
  assert.equal(motion.isHorizontallyMirrored('matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)', 'none'), true);
});

test('flight geometry follows a five-keyframe curved path to the target orientation and size', () => {
  const geometry = motion.createFlightGeometry(
    { left: 10, top: 20, width: 20, height: 40 },
    { left: 210, top: 320, width: 40, height: 80 },
    { sourceMirrored: false, targetMirrored: true },
  );

  assert.equal(geometry.keyframes.length, 5);
  assert.deepEqual(geometry.keyframes.map((frame) => frame.offset), [0, 0.24, 0.52, 0.78, 1]);
  assert.match(geometry.path, /^M 20 40 C /);
  assert.match(geometry.path, / 230 360$/);
  assert.match(geometry.keyframes[0].transform, /rotateY\(0deg\)/);
  assert.match(geometry.keyframes.at(-1).transform, /translate3d\(200px, 300px, 0\)/);
  assert.match(geometry.keyframes.at(-1).transform, /scale\(2, 2\)/);
  assert.match(geometry.keyframes.at(-1).transform, /rotateY\(180deg\)/);
  assert.match(geometry.keyframes.at(-1).transform, /rotateZ\(0deg\)/);
});

test('same source and target orientation completes a full flip', () => {
  const normal = motion.createFlightGeometry(
    { left: 0, top: 0, width: 70, height: 47 },
    { left: 100, top: 200, width: 70, height: 47 },
    { sourceMirrored: false, targetMirrored: false },
  );
  const mirrored = motion.createFlightGeometry(
    { left: 0, top: 0, width: 70, height: 47 },
    { left: 100, top: 200, width: 70, height: 47 },
    { sourceMirrored: true, targetMirrored: true },
  );

  assert.match(normal.keyframes[0].transform, /rotateY\(0deg\)/);
  assert.match(normal.keyframes.at(-1).transform, /rotateY\(360deg\)/);
  assert.match(mirrored.keyframes[0].transform, /rotateY\(180deg\)/);
  assert.match(mirrored.keyframes.at(-1).transform, /rotateY\(540deg\)/);
});

test('fallback target keeps source size and centers it inside a structural slot', () => {
  assert.deepEqual(
    motion.createFallbackTarget(
      { left: 10, top: 20, width: 70, height: 47 },
      { left: 0, top: 341, width: 393, height: 511 },
    ),
    { left: 161.5, top: 573, width: 70, height: 47 },
  );
});

test('motion timing and smoke layout are deterministic and reusable', () => {
  assert.equal(motion.FLIGHT_DURATION_MS, 1100);
  assert.equal(motion.SMOKE_DURATION_MS, 1050);
  assert.equal(motion.TOTAL_DURATION_MS, 2200);
  assert.equal(motion.SMOKE_PUFFS.length, 9);
  assert.deepEqual(motion.SMOKE_PUFFS[0], { x: 0, y: 0, size: 0.72, delay: 0 });
  assert.ok(motion.SMOKE_PUFFS.some((puff) => puff.x < 0));
  assert.ok(motion.SMOKE_PUFFS.some((puff) => puff.x > 0));
});
