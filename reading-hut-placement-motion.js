(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ReadingHutPlacementMotion = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const FLIGHT_DURATION_MS = 900;
  const SMOKE_DURATION_MS = 1050;
  const TOTAL_DURATION_MS = 2200;
  const SMOKE_PUFFS = [
    { x: 0, y: 0, size: 0.72, delay: 0 },
    { x: -0.38, y: -0.08, size: 0.56, delay: 35 },
    { x: 0.36, y: -0.12, size: 0.6, delay: 55 },
    { x: -0.2, y: -0.34, size: 0.48, delay: 90 },
    { x: 0.18, y: -0.38, size: 0.5, delay: 115 },
    { x: -0.46, y: 0.22, size: 0.42, delay: 145 },
    { x: 0.44, y: 0.2, size: 0.46, delay: 170 },
    { x: -0.08, y: 0.35, size: 0.4, delay: 205 },
    { x: 0.26, y: 0.34, size: 0.36, delay: 235 },
  ];

  function rounded(value) {
    return Math.round(value * 1000) / 1000;
  }

  function scaleAt(progress, endScale) {
    return rounded(1 + (endScale - 1) * progress);
  }

  function createFlightGeometry(source, target) {
    const dx = target.left - source.left;
    const dy = target.top - source.top;
    const scaleX = target.width / source.width;
    const scaleY = target.height / source.height;
    const lift = Math.max(70, Math.abs(dy) * 0.24);
    const startX = source.left + source.width / 2;
    const startY = source.top + source.height / 2;
    const endX = target.left + target.width / 2;
    const endY = target.top + target.height / 2;
    const control1X = startX + (endX - startX) * 0.3;
    const control1Y = startY - lift;
    const control2X = endX - (endX - startX) * 0.28;
    const control2Y = endY - lift * 0.45;

    return {
      path: 'M ' + rounded(startX) + ' ' + rounded(startY) +
        ' C ' + rounded(control1X) + ' ' + rounded(control1Y) +
        ', ' + rounded(control2X) + ' ' + rounded(control2Y) +
        ', ' + rounded(endX) + ' ' + rounded(endY),
      keyframes: [
        {
          offset: 0,
          opacity: 1,
          transform: 'translate3d(0px, 0px, 0) scale(1, 1) rotate(-4deg)',
        },
        {
          offset: 0.32,
          opacity: 1,
          transform: 'translate3d(' + rounded(dx * 0.28) + 'px, ' + rounded(dy * 0.08 - lift * 0.55) +
            'px, 0) scale(' + scaleAt(0.34, scaleX) + ', ' + scaleAt(0.34, scaleY) + ') rotate(6deg)',
        },
        {
          offset: 0.68,
          opacity: 1,
          transform: 'translate3d(' + rounded(dx * 0.72) + 'px, ' + rounded(dy * 0.55 - lift * 0.32) +
            'px, 0) scale(' + scaleAt(0.72, scaleX) + ', ' + scaleAt(0.72, scaleY) + ') rotate(-3deg)',
        },
        {
          offset: 1,
          opacity: 1,
          transform: 'translate3d(' + rounded(dx) + 'px, ' + rounded(dy) + 'px, 0) scale(' +
            rounded(scaleX) + ', ' + rounded(scaleY) + ') rotate(0deg)',
        },
      ],
    };
  }

  function relativeRect(element, layerRect) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - layerRect.left,
      top: rect.top - layerRect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function wait(milliseconds) {
    return new Promise(function (resolve) {
      root.setTimeout(resolve, milliseconds);
    });
  }

  function createSmoke(smokeLayer, target) {
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const baseSize = Math.max(target.width, target.height, 64);
    smokeLayer.replaceChildren();

    SMOKE_PUFFS.forEach(function (puff) {
      const node = smokeLayer.ownerDocument.createElement('span');
      node.className = 'placement-smoke-puff';
      node.style.left = centerX + 'px';
      node.style.top = centerY + 'px';
      node.style.setProperty('--puff-x', puff.x * baseSize + 'px');
      node.style.setProperty('--puff-y', puff.y * baseSize + 'px');
      node.style.setProperty('--puff-size', puff.size * baseSize + 'px');
      node.style.setProperty('--puff-delay', puff.delay + 'ms');
      smokeLayer.appendChild(node);
    });

    [-0.44, -0.16, 0.18, 0.42].forEach(function (offset, index) {
      const sparkle = smokeLayer.ownerDocument.createElement('span');
      sparkle.className = 'placement-sparkle';
      sparkle.style.left = centerX + offset * baseSize + 'px';
      sparkle.style.top = centerY + (index % 2 === 0 ? -0.42 : 0.34) * baseSize + 'px';
      sparkle.style.setProperty('--sparkle-delay', 180 + index * 95 + 'ms');
      smokeLayer.appendChild(sparkle);
    });
  }

  async function playPlacementMotion(options) {
    const layer = options.layer;
    const trailPath = options.trailPath;
    const smokeLayer = options.smokeLayer;
    const sourceElement = options.sourceElement;
    const targetElement = options.targetElement;
    const onImpact = typeof options.onImpact === 'function' ? options.onImpact : function () {};
    const reduceMotion = options.reduceMotion === true ||
      (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let impacted = false;

    function impact() {
      if (impacted) return;
      impacted = true;
      targetElement.classList.add('is-settling');
      onImpact();
    }

    if (reduceMotion || !sourceElement.animate) {
      impact();
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const source = relativeRect(sourceElement, layerRect);
    const target = relativeRect(targetElement, layerRect);
    const geometry = createFlightGeometry(source, target);
    const flyer = layer.ownerDocument.createElement('img');
    flyer.className = 'placement-flyer';
    flyer.src = options.imageSrc;
    flyer.alt = '';
    flyer.style.left = source.left + 'px';
    flyer.style.top = source.top + 'px';
    flyer.style.width = source.width + 'px';
    flyer.style.height = source.height + 'px';
    layer.appendChild(flyer);

    layer.classList.add('is-active');
    layer.setAttribute('aria-hidden', 'false');
    trailPath.setAttribute('d', geometry.path);
    const pathLength = trailPath.getTotalLength();
    trailPath.style.strokeDasharray = pathLength;
    trailPath.style.strokeDashoffset = pathLength;

    try {
      const trailAnimation = trailPath.animate([
        { opacity: 0, strokeDashoffset: pathLength },
        { opacity: 0.95, offset: 0.2, strokeDashoffset: pathLength * 0.72 },
        { opacity: 0.75, offset: 0.72, strokeDashoffset: pathLength * 0.18 },
        { opacity: 0, strokeDashoffset: 0 },
      ], {
        duration: FLIGHT_DURATION_MS,
        easing: 'cubic-bezier(0.22, 0.78, 0.16, 1)',
        fill: 'both',
      });
      const flightAnimation = flyer.animate(geometry.keyframes, {
        duration: FLIGHT_DURATION_MS,
        easing: 'cubic-bezier(0.22, 0.78, 0.16, 1)',
        fill: 'forwards',
      });

      await flightAnimation.finished;
      impact();
      flyer.style.opacity = '0';
      createSmoke(smokeLayer, target);
      smokeLayer.offsetWidth;
      smokeLayer.classList.add('is-active');
      await Promise.allSettled([trailAnimation.finished, wait(SMOKE_DURATION_MS)]);
      await wait(TOTAL_DURATION_MS - FLIGHT_DURATION_MS - SMOKE_DURATION_MS);
    } finally {
      impact();
      flyer.remove();
      smokeLayer.classList.remove('is-active');
      smokeLayer.replaceChildren();
      trailPath.removeAttribute('d');
      layer.classList.remove('is-active');
      layer.setAttribute('aria-hidden', 'true');
    }
  }

  return {
    FLIGHT_DURATION_MS: FLIGHT_DURATION_MS,
    SMOKE_DURATION_MS: SMOKE_DURATION_MS,
    TOTAL_DURATION_MS: TOTAL_DURATION_MS,
    SMOKE_PUFFS: SMOKE_PUFFS,
    createFlightGeometry: createFlightGeometry,
    playPlacementMotion: playPlacementMotion,
  };
});
