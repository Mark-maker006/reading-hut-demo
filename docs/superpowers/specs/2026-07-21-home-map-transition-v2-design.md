# 首页到地图转场 v2 设计说明

## 目标

调整现有首页 IP 点击转场，使卡片散开过程清晰可见，并把视觉层次改为：卡片推开、首页 hero 渐隐与无云地图渐显、云层四向进入、最终地图接管、进入可操作页面。

## 当前问题

- 当前卡片使用 400ms 快速缓出，并且透明度同步下降；约 200ms 时内容已接近不可见。
- 当前最终地图和云层几乎同时开始出现，无法清楚感知“首页退场 → 地图出现 → 云层进入”的先后关系。
- 过渡舞台直接使用包含固定云层的最终地图，因此再叠加飞入云层时容易产生提前露云或重复叠影。

## 已确认方案

采用“纯地图先渐显”的均衡节奏，总时长约 1500ms。

| 时间 | 阶段 | 视觉行为 |
| --- | --- | --- |
| 0–650ms | 卡片推开 | `.profile`、`.weekly`、`.reading-card`、`.next-plan`、`.tabbar` 从 IP 向外散开。transform 使用缓入缓出；前半段保持清晰，约 300ms 后再开始淡出。IP 和状态栏保持固定。 |
| 520–900ms | 地图交叉渐变 | hero 背景、遮罩和 IP 渐隐；蓝湖“地图-切图”的无云地图从透明渐显。两个阶段轻微重叠，避免空白帧。 |
| 850–1350ms | 云层进入 | 无云地图基本可见后，四个互补云层裁片从上、左、右、下进入并对齐。 |
| 1350–1500ms | 最终接管 | `map-final-lanhu.png` 渐显；动画云层淡出并衔接最终图中的固定云层。 |
| 1500ms | 页面导航 | 写入单次 handoff 标记并导航到 `level-map.html`；地图页消费标记后正常可操作。 |

## 图层结构

过渡舞台从下到上包含：

1. 蓝湖“地图-切图”原始 PNG，保存为 `assets/map-transition-base-lanhu.png`，只用于交叉渐变阶段。
2. 现有 `assets/map-final-lanhu.png`，仅在 settling 阶段渐显。
3. 现有 `assets/map-cloud-overlay.png` 的四个互补方向裁片，进入完成后淡出。
4. 资源失败时的白雾回退层。

首页 hero 的 `.hero-art`、`.hero-mask`、`.hero-ip-art` 在 `map-revealing` 状态渐隐。状态栏不参与卡片散开；随着全屏地图图层渐显自然被覆盖。

## 状态和时间常量

控制器状态改为：

`idle → scattering → map-revealing → cloud-covering → settling → navigating`

公开时间常量：

```js
const TIMING = Object.freeze({
  scatterDuration: 650,
  mapRevealStart: 520,
  cloudStart: 850,
  settleStart: 1350,
  navigateAt: 1500,
  reducedNavigateAt: 180,
});
```

减弱动效继续使用约 180ms 的透明度过渡，不执行卡片位移和云层飞入。

## 交互与异常处理

- 保留双击防重、键盘 Enter、单次导航和 storage 事务式消费。
- 保留 `pagehide/pageshow` 后退缓存恢复逻辑，Back 返回首页后可再次进入地图。
- 三张过渡素材预加载去重；任一素材加载失败时启用白雾遮挡回退，但不阻塞导航。
- 地图页三个热点和现有交互逻辑不变。

## 测试与验收

- TDD 更新控制器时间常量和新增 `map-revealing` 状态边界测试。
- TDD 更新 bootstrap 状态到 CSS class 的映射测试。
- 静态测试锁定无云地图素材引用、图层顺序、650ms 卡片动画、延迟淡出、380ms 地图交叉渐变和 500ms 云层进入。
- 393×852 渲染验证关键帧：约 300ms 卡片仍清晰可辨；约 700ms hero/无云地图交叉渐变；约 1050ms 云层从四边进入；约 1450ms 最终地图接管；约 1500ms 页面可访问。
- 继续验证双击、Enter、Back、控制台健康和 reduced-motion。

## 范围外

- 不重做地图页布局。
- 不更改三个地图热点位置或目标。
- 不修改阅读小屋相关状态和既有 30/500 星测试冲突。
