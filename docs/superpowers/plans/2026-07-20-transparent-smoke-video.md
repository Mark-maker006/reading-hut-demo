# Transparent Smoke Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Reading Hut's generated CSS impact smoke with the supplied smoke animation after removing its cream background, while preserving the existing 1.05-second impact timing and cleanup behavior.

**Architecture:** Build a 512×512 transparent VP9 WebM offline by extracting the source MP4 through Remotion's bundled FFmpeg, generating an alpha matte from frame-to-background differences, and re-encoding selected frames at 24fps. At runtime, `reading-hut-placement-motion.js` creates one muted inline `<video>` centered on the target; if decoding or autoplay fails it recreates the existing CSS puff/sparkle fallback.

**Compatibility amendment:** Rendered QA later reproduced that an embedded VP9 WebM can remain at `readyState=0` when the page is opened directly through `file://`. The same transparent frames load as animated WebP in that environment, so the final runtime uses `assets/placement-smoke.webp` in a preloaded `<img>`; the WebM is retained as the transparent video deliverable, and CSS puffs/sparkles remain the final load-error fallback.

**Tech Stack:** Remotion CLI FFmpeg/FFprobe, Python with Pillow and NumPy for background-difference matting, VP9 WebM with alpha, native JavaScript, CSS, Node test runner, Playwright.

---

### Task 1: Generate the transparent smoke asset

**Files:**
- Create: `scripts/build-transparent-smoke.py`
- Create: `assets/placement-smoke.webm`
- Source only: `D:\YDXDR_Game\素材拆分\烟雾动效.mp4`

- [x] **Step 1: Add a reproducible background-difference build script**

The script must:

```text
accept input MP4 and output WebM paths
invoke: npx --yes --package=@remotion/cli@4.0.494 remotion ffmpeg
extract all 960×960 source frames to a temporary directory
build a clean background plate from the median of the first four frames
select 26 evenly spaced frames across the complete 5.04-second source
compute per-pixel RGB Euclidean distance from the background plate
map differences below 4 to transparent and differences at or above 26 to opaque
apply a light 1px Gaussian blur to the alpha matte
keep the source RGB values so cream smoke remains naturally translucent
resize RGBA frames to 512×512 with Lanczos resampling
encode the 26-frame sequence at 24fps with libvpx-vp9, yuva420p, and auto-alt-ref disabled
remove temporary frames even when the command fails
```

The encoder command must follow Remotion's transparent video guidance:

```powershell
npx --yes --package=@remotion/cli@4.0.494 remotion ffmpeg `
  -framerate 24 -i frame-%03d.png `
  -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -an `
  -y assets/placement-smoke.webm
```

- [x] **Step 2: Generate the asset**

Run:

```powershell
python scripts/build-transparent-smoke.py `
  "D:\YDXDR_Game\素材拆分\烟雾动效.mp4" `
  "assets\placement-smoke.webm"
```

Expected: exit 0 and a non-empty `assets/placement-smoke.webm`.

- [x] **Step 3: Verify codec, dimensions, duration, and alpha metadata**

Run Remotion ffprobe and require:

```text
codec_name: vp9
width/height: 512×512
duration: approximately 1.083 seconds
alpha_mode: 1
```

Decode a middle frame to PNG through Remotion FFmpeg and verify the image has both fully transparent background pixels and non-zero smoke pixels.

### Task 2: Replace CSS smoke with the transparent video

**Files:**
- Modify: `tests/reading-hut-placement-motion.test.js`
- Modify: `tests/reading-hut-placement.test.js`
- Modify: `reading-hut-placement-motion.js`
- Modify: `reading-hut.css`

- [x] **Step 1: Write failing tests for the desired smoke-video contract**

Extend the motion tests so the desired API is explicit:

```javascript
assert.equal(motion.SMOKE_VIDEO_SRC, './assets/placement-smoke.webm');

const result = motion.createSmoke(smokeLayer, target);
assert.equal(result.className, 'placement-smoke-video');
assert.equal(result.src, './assets/placement-smoke.webm');
assert.equal(result.muted, true);
assert.equal(result.autoplay, true);
assert.equal(result.playsInline, true);
assert.equal(result.style.left, '100px');
assert.equal(result.style.top, '120px');
assert.equal(result.style.getPropertyValue('--smoke-video-size'), '192px');
```

Use a small fake document/element implementation. Add a second test that triggers the registered `error` callback and verifies the video is replaced by nine `.placement-smoke-puff` nodes and four `.placement-sparkle` nodes.

Extend the page integration test to assert that CSS contains `.placement-smoke-video` with absolute centering, `object-fit: contain`, `pointer-events: none`, and z-index 4.

- [x] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/reading-hut-placement-motion.test.js
node --test --test-name-pattern "reading hut declares a native motion layer" tests/reading-hut-placement.test.js
```

Expected: FAIL because `SMOKE_VIDEO_SRC`, exported `createSmoke`, and `.placement-smoke-video` do not exist.

- [x] **Step 3: Implement the minimum runtime integration**

In `reading-hut-placement-motion.js`:

```javascript
const SMOKE_VIDEO_SRC = './assets/placement-smoke.webm';
```

Rename the current DOM generator to `createLegacySmoke(smokeLayer, target)`. Implement `createSmoke(smokeLayer, target, videoSrc)` to create one muted, autoplaying, inline video, position it at the target center, set `--smoke-video-size` to `Math.max(target.width, target.height, 64) * 3`, and return the video. Register a once-only fallback that replaces the video with `createLegacySmoke()` on `error` or rejected `play()`.

Keep these timing constants unchanged:

```javascript
FLIGHT_DURATION_MS = 1100
SMOKE_DURATION_MS = 1050
TOTAL_DURATION_MS = 2200
```

Export `SMOKE_VIDEO_SRC` and `createSmoke` for focused tests.

In `reading-hut.css`, add:

```css
.placement-smoke-video {
  position: absolute;
  z-index: 4;
  width: var(--smoke-video-size);
  height: var(--smoke-video-size);
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
```

Do not normally create `.placement-smoke-puff` or `.placement-sparkle`; retain their existing CSS only for fallback.

- [x] **Step 4: Run focused tests and verify GREEN**

Run both focused commands from Step 2 and require zero failures.

### Task 3: Rendered interaction and regression verification

**Files:**
- Verify only; do not commit screenshots or temporary scripts.

- [x] **Step 1: Verify the real placement flow**

At 394×852:

```text
open the furniture bag
purchase Reading Rug
click Reading Rug to place it
verify the transparent smoke video appears at the landing point
verify the room remains visible through transparent background pixels
verify the video, flyer, fallback nodes, and SVG path are removed after completion
verify the rug reaches is-placed
verify no relevant console warnings/errors
```

- [x] **Step 2: Verify fallback and reduced motion**

Confirm a missing/failed WebM triggers the CSS puff fallback. Confirm `prefers-reduced-motion: reduce` skips the video and still completes placement.

- [x] **Step 3: Run regression tests**

Run focused tests and the complete `tests/*.test.js` collection. Report the known pre-existing 500-star versus 30-star assertion failures separately; do not alter those user changes.
