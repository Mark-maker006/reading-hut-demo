# Game Audio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入五个指定音频，使首页入口、小屋特殊交互、普通 UI 和两个页面的循环 BGM 按批准映射播放，且音频失败不影响原交互。

**Architecture:** 新建无依赖 UMD `audio-manager.js`，Node 测试与浏览器共用同一 API。页面仅用 `data-audio`/`data-audio-bgm` 声明例外；一次 `document` 点击委托覆盖普通 `button` 与 `a[href]`，被拦截的 BGM 在首次 `pointerdown` 或 `keydown` 重试。

**Tech Stack:** 静态 HTML、原生 JavaScript、HTMLAudioElement、Node.js `node:test`、Playwright 1.61.1、PowerShell。

---

## 工作区边界与文件映射

当前工作区有大量用户的 staged、modified、untracked 变更。执行时禁止 `git add`、`git commit`、`git reset`、`git checkout`、`git clean`、批量格式化和覆盖无关文件。每个任务后只检查本任务路径。

2026-07-23 基线：`node --test` 共 115 项，108 通过、7 失败。既有失败均是当前 30/500 星状态分歧：`reading-hut-exchange-success-feedback.test.js` 1 项、`reading-hut-figma-panels.test.js` 1 项、`reading-hut-placement.test.js` 1 项、`reading-hut-state.test.js` 4 项。不得顺手修复；最终要求音频测试全绿且不新增失败。

**Create:** `audio-manager.js`、`tests/audio-manager.test.js`、`tests/audio-integration.test.js`、`assets/audio/{entrance-enter,map-bgm,reading-hut-bgm,hut-item-click,ui-click}.mp3`

**Modify:** `index.html`、`level-map.html`、`reading-hut.html`、`illustration-book.html`、`achievement.html`、`tests/project-structure.test.js`

### Task 1: 单测驱动统一音频管理器

**Files:**
- Create: `tests/audio-manager.test.js`
- Create: `audio-manager.js`

- [ ] **Step 1: 写 RED 单测**

在 `tests/audio-manager.test.js` 使用 `node:test`，创建可记录 `src/loop/currentTime/playCalls` 的 `FakeAudio` 和带 `addEventListener/removeEventListener/dispatch/body.dataset` 的假 document，写以下精确断言：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { AUDIO_MANIFEST, createAudioManager, resolveClickAudioName } = require('../audio-manager.js');

test('manifest contains only approved files and loop flags', () => {
  assert.deepEqual(AUDIO_MANIFEST, {
    'entrance-enter': { src: './assets/audio/entrance-enter.mp3', loop: false },
    'map-bgm': { src: './assets/audio/map-bgm.mp3', loop: true },
    'reading-hut-bgm': { src: './assets/audio/reading-hut-bgm.mp3', loop: true },
    'hut-item-click': { src: './assets/audio/hut-item-click.mp3', loop: false },
    'ui-click': { src: './assets/audio/ui-click.mp3', loop: false },
  });
});

test('special audio wins over generic controls', () => {
  const special = { getAttribute: () => 'hut-item-click' };
  const target = { closest: (selector) => selector === '[data-audio]' ? special : {} };
  assert.equal(resolveClickAudioName(target), 'hut-item-click');
});

test('generic matching includes enabled controls and ignores non-controls', () => {
  assert.equal(resolveClickAudioName({ closest: (s) => s.includes('button:not') ? {} : null }), 'ui-click');
  assert.equal(resolveClickAudioName({ closest: () => null }), null);
});

test('two rapid special clicks restart only the special effect', async () => {
  const { document, dispatch } = createFakeDocument();
  const audio = createFakeAudio();
  const manager = createAudioManager({ document, Audio: audio.Audio });
  manager.start();
  dispatch('click', createTarget('hut-item-click', true));
  dispatch('click', createTarget('hut-item-click', true));
  await flushPromises();
  assert.equal(audio.find('hut-item-click.mp3').playCalls, 2);
  assert.equal(audio.find('hut-item-click.mp3').currentTime, 0);
  assert.equal(audio.find('ui-click.mp3').playCalls, 0);
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
```

测试文件中使用以下完整辅助函数；`createFakeAudio(blockedSuffix)` 仅在匹配音频第一次 `play()` 时 reject：

```js
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
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

function createFakeAudio(blockedSuffix) {
  const instances = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.loop = false;
      this.preload = '';
      this.currentTime = -1;
      this.playCalls = 0;
      instances.push(this);
    }
    play() {
      this.playCalls += 1;
      if (blockedSuffix && this.src.endsWith(blockedSuffix) && this.playCalls === 1) {
        return Promise.reject(new Error('autoplay blocked'));
      }
      return Promise.resolve();
    }
  }
  return {
    Audio: FakeAudio,
    find(suffix) {
      return instances.find((instance) => instance.src.endsWith(suffix));
    },
  };
}
```

- [ ] **Step 2: 确认 RED**

Run: `node --test tests/audio-manager.test.js`

Expected: FAIL，`Cannot find module '../audio-manager.js'`，不是语法失败。

- [ ] **Step 3: 写最小完整实现**

创建 `audio-manager.js`，沿用项目 UMD 模式：

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.GameAudio = api;
  if (!root.document || typeof root.Audio !== 'function') return;
  const bootstrap = function () {
    root.GameAudioManager = api.createAudioManager({ document: root.document, Audio: root.Audio });
    root.GameAudioManager.start();
  };
  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else bootstrap();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const AUDIO_MANIFEST = Object.freeze({
    'entrance-enter': Object.freeze({ src: './assets/audio/entrance-enter.mp3', loop: false }),
    'map-bgm': Object.freeze({ src: './assets/audio/map-bgm.mp3', loop: true }),
    'reading-hut-bgm': Object.freeze({ src: './assets/audio/reading-hut-bgm.mp3', loop: true }),
    'hut-item-click': Object.freeze({ src: './assets/audio/hut-item-click.mp3', loop: false }),
    'ui-click': Object.freeze({ src: './assets/audio/ui-click.mp3', loop: false }),
  });

  function resolveClickAudioName(target) {
    if (!target || typeof target.closest !== 'function') return null;
    try {
      const special = target.closest('[data-audio]');
      if (special) return special.getAttribute('data-audio') || null;
      return target.closest('button:not([disabled]), a[href]') ? 'ui-click' : null;
    } catch (error) { return null; }
  }

  function createAudioManager(options) {
    const document = options.document;
    const AudioConstructor = options.Audio;
    const manifest = options.manifest || AUDIO_MANIFEST;
    const cache = new Map();
    let started = false;
    let retryArmed = false;
    let pendingBackground = null;

    function getAudio(name) {
      if (!manifest[name]) return null;
      if (cache.has(name)) return cache.get(name);
      try {
        const audio = new AudioConstructor(manifest[name].src);
        audio.preload = 'auto';
        audio.loop = manifest[name].loop === true;
        cache.set(name, audio);
        return audio;
      } catch (error) { return null; }
    }
    function playAudio(audio) {
      if (!audio) return Promise.resolve(false);
      try {
        return Promise.resolve(audio.play()).then(() => true, () => false);
      } catch (error) { return Promise.resolve(false); }
    }
    function playEffect(name) {
      if (!manifest[name] || manifest[name].loop) return Promise.resolve(false);
      const audio = getAudio(name);
      if (!audio) return Promise.resolve(false);
      try { audio.currentTime = 0; } catch (error) {}
      return playAudio(audio);
    }
    function disarmRetry() {
      if (!retryArmed) return;
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
      if (retryArmed) return;
      retryArmed = true;
      document.addEventListener('pointerdown', retryBackground);
      document.addEventListener('keydown', retryBackground);
    }
    function startBackground(name) {
      if (!manifest[name] || !manifest[name].loop) return Promise.resolve(false);
      return playAudio(getAudio(name)).then((played) => {
        if (!played) { pendingBackground = name; armRetry(); }
        return played;
      });
    }
    function handleClick(event) {
      const name = resolveClickAudioName(event.target);
      if (name) void playEffect(name);
    }
    function start() {
      if (started) return;
      started = true;
      Object.keys(manifest).forEach(getAudio);
      document.addEventListener('click', handleClick);
      const name = document.body && document.body.dataset.audioBgm;
      if (name) void startBackground(name);
    }
    function destroy() {
      if (!started) return;
      started = false;
      document.removeEventListener('click', handleClick);
      disarmRetry();
      pendingBackground = null;
    }
    return { start, destroy, playEffect, startBackground };
  }
  return { AUDIO_MANIFEST, createAudioManager, resolveClickAudioName };
});
```

- [ ] **Step 4: 确认 GREEN 并审范围**

Run: `node --test tests/audio-manager.test.js`

Expected: 全部 PASS，无 unhandled rejection。

Run: `git diff -- audio-manager.js tests/audio-manager.test.js`

Expected: 只含两个新文件；不 stage、不 commit。

### Task 2: 集成测试 RED 后复制资源并接线页面

**Files:**
- Create: `tests/audio-integration.test.js`
- Create: five files under `assets/audio/`
- Modify: five active HTML pages and `tests/project-structure.test.js`

- [ ] **Step 1: 写结构与 Playwright RED 测试**

`tests/audio-integration.test.js` 必须断言：

```js
const pages = ['index.html', 'level-map.html', 'reading-hut.html', 'illustration-book.html', 'achievement.html'];
pages.forEach((name) => assert.match(read(name), /<script src="\.\/audio-manager\.js" defer><\/script>/));
assert.deepEqual(fs.readdirSync(path.join(root, 'assets', 'audio')).sort(), [
  'entrance-enter.mp3', 'hut-item-click.mp3', 'map-bgm.mp3',
  'reading-hut-bgm.mp3', 'ui-click.mp3',
]);
assert.match(read('index.html'), /class="hero-ip"[^>]*data-audio="entrance-enter"/);
assert.match(read('level-map.html'), /<body data-audio-bgm="map-bgm">/);
assert.match(read('reading-hut.html'), /<body data-audio-bgm="reading-hut-bgm">/);
assert.match(read('reading-hut.html'), /el\.dataset\.audio = 'hut-item-click';/);
```

用 `context.addInitScript()` 将 `window.Audio` 替换为把 `{src, loop, at, call}` 写入 `window.__audioEvents` 的假类，再写两个 Playwright 测试：

1. `index.html` 点击 `.hero-ip` 后事件仅一个、文件为 `entrance-enter.mp3`、`event.at - clickedAt < 100`；`reading-hut.html` 自动播放循环 BGM，`.room-action-bag` 和动态 `.bag-item` 各仅触发一次 `hut-item-click.mp3`，`.exchange-cancel` 仅触发一次 `ui-click.mp3`。
2. `level-map.html` 第一次 `map-bgm.mp3` play 被替身 reject；`body` 首次 `pointerdown` 后调用数从 1 变 2，再按 Tab 仍为 2，且两次 `loop` 都为 true。

在 `tests/project-structure.test.js` 的 `activeSources` 加入 `'audio-manager.js'`，使五个本地音频引用也接受缺失检查。

- [ ] **Step 2: 确认 RED**

Run: `node --test tests/audio-integration.test.js tests/project-structure.test.js`

Expected: FAIL，原因是页面未加载管理器或 `assets/audio` 不存在。

- [ ] **Step 3: 安全复制五个正式资源并校验哈希**

```powershell
if ((Test-Path '.\assets\audio') -and (Get-ChildItem '.\assets\audio' -File)) { throw 'Inspect existing assets/audio before copying' }
New-Item -ItemType Directory '.\assets\audio' -Force | Out-Null
Copy-Item -LiteralPath 'D:\YDXDR_Game\sounds\入口进入1.mp3' '.\assets\audio\entrance-enter.mp3' -NoClobber
Copy-Item -LiteralPath 'D:\YDXDR_Game\sounds\地图页2.mp3' '.\assets\audio\map-bgm.mp3' -NoClobber
Copy-Item -LiteralPath 'D:\YDXDR_Game\sounds\房间内.mp3' '.\assets\audio\reading-hut-bgm.mp3' -NoClobber
Copy-Item -LiteralPath 'D:\YDXDR_Game\sounds\点击1.mp3' '.\assets\audio\hut-item-click.mp3' -NoClobber
Copy-Item -LiteralPath 'D:\YDXDR_Game\sounds\点击2.mp3' '.\assets\audio\ui-click.mp3' -NoClobber
```

对五组源/目标运行 `Get-FileHash -Algorithm SHA256 -LiteralPath` 并断言相等。`入口进入2.mp3`、`地图页1.mp3` 不得复制或引用。

- [ ] **Step 4: 接线页面**

五个页面 `</head>` 前统一加入：

```html
<script src="./audio-manager.js" defer></script>
```

精确标记：

```html
<!-- index.html -->
<a class="hero-ip" href="./level-map.html?v=20260722" data-audio="entrance-enter" aria-label="进入关卡地图"></a>
<!-- level-map.html -->
<body data-audio-bgm="map-bgm">
<!-- reading-hut.html -->
<body data-audio-bgm="reading-hut-bgm">
<button class="room-action room-action-bag" type="button" data-audio="hut-item-click" aria-label="Open bag">
<button class="room-action room-action-decorations" type="button" data-audio="hut-item-click" aria-label="Open decorations bag">
<button class="bag-close" type="button" data-audio="hut-item-click" aria-label="关闭面板"></button>
```

在 `renderItems()` 的 `el.type = 'button';` 后加入：

```js
el.dataset.audio = 'hut-item-click';
```

其余真实启用 `button` 和 `a[href]` 保持无标记，自动使用 `ui-click`。不要修改 `home-map-transition.js` 或 1.5 秒时序，不给普通导航增加等待。拖动后的 item click 已在捕获阶段 `preventDefault/stopPropagation`，不要改监听顺序。

- [ ] **Step 5: 确认 GREEN**

Run: `node --test tests/audio-manager.test.js tests/audio-integration.test.js tests/project-structure.test.js`

Expected: 全部 PASS；特殊点击不重复，普通点击正确，两个 BGM 循环且恢复策略通过。

Run: `node --test tests/reading-hut-figma-panels.test.js --test-name-pattern="horizontal pointer dragging"`

Expected: PASS，证明拖动抑制仍有效。

### Task 3: 验收与全量回归

**Files:** Verify only.

- [ ] **Step 1: 定向验收**

Run: `node --test tests/audio-manager.test.js tests/audio-integration.test.js tests/project-structure.test.js tests/home-map-transition.test.js`

Expected: 全部 PASS，首页转场未退化。

- [ ] **Step 2: 现有 Playwright 回归**

Run:

```powershell
node --test tests/reading-hut-card-activation.test.js tests/reading-hut-decoration-panel.test.js tests/reading-hut-exchange-dialog.test.js tests/reading-hut-exchange-success-feedback.test.js tests/reading-hut-placement.test.js
```

Expected: 不新增音频相关失败；当前仅允许两个已知余额断言继续失败，不得改 30/500 星逻辑。

- [ ] **Step 3: 全量回归并对比基线**

Run: `node --test`

Expected on current worktree: 音频测试全绿；失败集合不超过已记录 7 项。若用户已解决星状态分歧则应全绿，否则允许 exit 1 但必须仍是同一组 7 项。

- [ ] **Step 4: 实际浏览器听感验收**

Run: `python -m http.server 4173`

依次检查 `/`、`/level-map.html`、`/reading-hut.html`、`/illustration-book.html`、`/achievement.html`：入口 100ms 内响；地图/小屋 BGM 循环；小屋入口/关闭/物品为 `点击1`；其它启用按钮/链接为 `点击2`；一次交互只响一次；blocked BGM 首次交互恢复；音频加载失败不破坏导航、弹窗或动画。完成后 `Ctrl+C`。

- [ ] **Step 5: 审核并交付，不提交**

Run: `git diff -- audio-manager.js index.html level-map.html reading-hut.html illustration-book.html achievement.html tests/audio-manager.test.js tests/audio-integration.test.js tests/project-structure.test.js` and `git status --short`

Expected: 仅本任务文件与五个英文名音频属于本次成果；保留所有原用户改动，不 stage、不 commit、不清理。交付时报告定向测试、全量测试与仍存在的既有失败。
