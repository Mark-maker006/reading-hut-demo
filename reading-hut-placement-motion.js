(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ReadingHutPlacementMotion = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const FLIGHT_DURATION_MS = 1100;
  const SMOKE_DURATION_MS = 1050;
  const TOTAL_DURATION_MS = 2200;
  const SMOKE_IMAGE_SRC = './assets/placement-smoke.webp';
  const SMOKE_READINESS_TIMEOUT_MS = 325;
  const smokeOwners = new WeakMap();
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

  function createEmissionPoints(previous, current, spacing) {
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return [];

    const count = Math.max(1, Math.ceil(distance / spacing));
    return Array.from({ length: count }, function (_, index) {
      const progress = (index + 1) / count;
      return {
        x: rounded(previous.x + dx * progress),
        y: rounded(previous.y + dy * progress),
      };
    });
  }

  function particleOpacity(progress) {
    const clamped = Math.min(1, Math.max(0, progress));
    return rounded(Math.pow(1 - clamped, 1.6));
  }

  function particleScale(progress) {
    const clamped = Math.min(1, Math.max(0, progress));
    return rounded(1 - clamped * 0.7);
  }

  function updateParticle(particle, deltaMs) {
    const age = particle.age + deltaMs;
    if (age >= particle.lifetime) return null;

    const seconds = deltaMs / 1000;
    return Object.assign({}, particle, {
      x: rounded(particle.x + particle.velocityX * seconds),
      y: rounded(particle.y + particle.velocityY * seconds),
      age: age,
      rotation: rounded(particle.rotation + particle.rotationSpeed * seconds),
    });
  }

  function scaleAt(progress, endScale) {
    return rounded(1 + (endScale - 1) * progress);
  }

  function isHorizontallyMirrored(transform, scale) {
    const scaleMatch = String(scale || '').match(/^\s*(-?\d*\.?\d+)/);
    if (scaleMatch && Number(scaleMatch[1]) < 0) return true;

    const matrixMatch = String(transform || '').match(/^matrix\(\s*(-?\d*\.?\d+)/);
    if (matrixMatch) return Number(matrixMatch[1]) < 0;

    const matrix3dMatch = String(transform || '').match(/^matrix3d\(\s*(-?\d*\.?\d+)/);
    return Boolean(matrix3dMatch && Number(matrix3dMatch[1]) < 0);
  }

  function orientationAngles(sourceMirrored, targetMirrored) {
    const start = sourceMirrored ? 180 : 0;
    let end = targetMirrored ? 180 : 0;
    if (end <= start) end += 360;
    return { start: start, end: end };
  }

  function flightTransform(x, y, scaleX, scaleY, yaw, zRotation) {
    return 'perspective(700px) translate3d(' + rounded(x) + 'px, ' + rounded(y) +
      'px, 0) scale(' + rounded(scaleX) + ', ' + rounded(scaleY) + ') rotateY(' +
      rounded(yaw) + 'deg) rotateZ(' + rounded(zRotation) + 'deg)';
  }

  function createFlightGeometry(source, target, orientation) {
    const dx = target.left - source.left;
    const dy = target.top - source.top;
    const scaleX = target.width / source.width;
    const scaleY = target.height / source.height;
    const direction = orientation || {};
    const yaw = orientationAngles(direction.sourceMirrored === true, direction.targetMirrored === true);
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
          transform: flightTransform(0, 0, 1, 1, yaw.start, -4),
        },
        {
          offset: 0.24,
          opacity: 1,
          transform: flightTransform(
            dx * 0.18,
            dy * 0.02 - lift * 0.48,
            scaleAt(0.24, scaleX),
            scaleAt(0.24, scaleY),
            yaw.start + (yaw.end - yaw.start) * 0.24,
            7,
          ),
        },
        {
          offset: 0.52,
          opacity: 1,
          transform: flightTransform(
            dx * 0.52,
            dy * 0.28 - lift * 0.52,
            scaleAt(0.52, scaleX),
            scaleAt(0.52, scaleY),
            yaw.start + (yaw.end - yaw.start) * 0.52,
            -5,
          ),
        },
        {
          offset: 0.78,
          opacity: 1,
          transform: flightTransform(
            dx * 0.82,
            dy * 0.68 - lift * 0.22,
            scaleAt(0.82, scaleX),
            scaleAt(0.82, scaleY),
            yaw.start + (yaw.end - yaw.start) * 0.78,
            2,
          ),
        },
        {
          offset: 1,
          opacity: 1,
          transform: flightTransform(dx, dy, scaleX, scaleY, yaw.end, 0),
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

  function createFallbackTarget(source, slot) {
    return {
      left: slot.left + (slot.width - source.width) / 2,
      top: slot.top + (slot.height - source.height) / 2,
      width: source.width,
      height: source.height,
    };
  }

  function wait(milliseconds) {
    return new Promise(function (resolve) {
      root.setTimeout(resolve, milliseconds);
    });
  }

  function startStarTrail(canvas, layer, flyer) {
    const requestFrame = root.requestAnimationFrame
      ? root.requestAnimationFrame.bind(root)
      : null;
    const cancelFrame = root.cancelAnimationFrame
      ? root.cancelAnimationFrame.bind(root)
      : function () {};
    const context = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    if (!canvas || !layer || !flyer || !context || !requestFrame) {
      return function () {};
    }

    let frameId = null;
    let emitting = true;
    let previousPosition = null;
    let previousTimestamp = null;
    let particles = [];
    let canvasWidth = 0;
    let canvasHeight = 0;
    let pixelRatio = 1;

    function syncCanvas(layerRect) {
      pixelRatio = Math.max(1, root.devicePixelRatio || 1);
      canvasWidth = layerRect.width;
      canvasHeight = layerRect.height;
      const width = Math.max(1, Math.round(canvasWidth * pixelRatio));
      const height = Math.max(1, Math.round(canvasHeight * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function clearCanvas() {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    function createParticle(point, direction) {
      const choice = Math.random();
      const backwardOffset = 2 + Math.random() * 7;
      const sideways = (Math.random() - 0.5) * 7;
      let shape = 'star';
      let color = '#FFD85A';

      if (choice >= 0.85) {
        shape = 'glint';
        color = '#F6A63A';
      } else if (choice >= 0.6) {
        shape = 'dot';
        color = '#FFF1A8';
      }

      return {
        x: point.x - direction.x * backwardOffset - direction.y * sideways,
        y: point.y - direction.y * backwardOffset + direction.x * sideways,
        velocityX: -direction.x * (8 + Math.random() * 12) - direction.y * sideways * 1.8,
        velocityY: -direction.y * (8 + Math.random() * 12) + direction.x * sideways * 1.8 - 4,
        age: 0,
        lifetime: 350 + Math.random() * 300,
        size: 45 + Math.random() * 35,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 5,
        shape: shape,
        color: color,
      };
    }

    function drawParticle(particle) {
      const progress = particle.age / particle.lifetime;
      const scale = particleScale(progress);
      const radius = particle.size / 2;
      context.save();
      context.globalAlpha = particleOpacity(progress);
      context.globalCompositeOperation = 'lighter';
      context.fillStyle = particle.color;
      context.shadowColor = particle.color;
      context.shadowBlur = particle.shape === 'dot' ? 6 : 9;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.scale(scale, scale);
      context.beginPath();

      if (particle.shape === 'dot') {
        context.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
      } else if (particle.shape === 'glint') {
        context.moveTo(0, -radius);
        context.lineTo(radius * 0.32, -radius * 0.18);
        context.lineTo(radius, 0);
        context.lineTo(radius * 0.32, radius * 0.18);
        context.lineTo(0, radius);
        context.lineTo(-radius * 0.32, radius * 0.18);
        context.lineTo(-radius, 0);
        context.lineTo(-radius * 0.32, -radius * 0.18);
        context.closePath();
      } else {
        for (let index = 0; index < 10; index += 1) {
          const angle = -Math.PI / 2 + index * Math.PI / 5;
          const pointRadius = index % 2 === 0 ? radius : radius * 0.42;
          const x = Math.cos(angle) * pointRadius;
          const y = Math.sin(angle) * pointRadius;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
      }

      context.fill();
      context.restore();
    }

    function animate(timestamp) {
      const layerRect = layer.getBoundingClientRect();
      syncCanvas(layerRect);
      const deltaMs = previousTimestamp === null
        ? 0
        : Math.min(64, Math.max(0, timestamp - previousTimestamp));
      previousTimestamp = timestamp;

      if (emitting) {
        const flyerRect = flyer.getBoundingClientRect();
        const currentPosition = {
          x: flyerRect.left - layerRect.left + flyerRect.width / 2,
          y: flyerRect.top - layerRect.top + flyerRect.height / 2,
        };

        if (previousPosition) {
          const dx = currentPosition.x - previousPosition.x;
          const dy = currentPosition.y - previousPosition.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0) {
            const direction = { x: dx / distance, y: dy / distance };
            createEmissionPoints(previousPosition, currentPosition, 6).forEach(function (point) {
              particles.push(createParticle(point, direction));
            });
          }
        }
        previousPosition = currentPosition;
      }

      particles = particles.map(function (particle) {
        return updateParticle(particle, deltaMs);
      }).filter(Boolean);

      clearCanvas();
      particles.forEach(drawParticle);

      if (emitting || particles.length > 0) {
        frameId = requestFrame(animate);
      } else {
        frameId = null;
      }
    }

    frameId = requestFrame(animate);

    return function stopStarTrail(immediate) {
      emitting = false;
      previousPosition = null;
      if (immediate === true) {
        particles = [];
        if (frameId !== null) cancelFrame(frameId);
        frameId = null;
        clearCanvas();
      }
    };
  }

  function createLegacySmoke(smokeLayer, target, elapsedMs) {
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const baseSize = Math.max(target.width, target.height, 64);
    const elapsed = Math.min(SMOKE_DURATION_MS, Math.max(0, Number(elapsedMs) || 0));
    smokeLayer.replaceChildren();

    SMOKE_PUFFS.forEach(function (puff) {
      const node = smokeLayer.ownerDocument.createElement('span');
      node.className = 'placement-smoke-puff';
      node.style.left = centerX + 'px';
      node.style.top = centerY + 'px';
      node.style.setProperty('--puff-x', puff.x * baseSize + 'px');
      node.style.setProperty('--puff-y', puff.y * baseSize + 'px');
      node.style.setProperty('--puff-size', puff.size * baseSize + 'px');
      node.style.setProperty('--puff-delay', puff.delay - elapsed + 'ms');
      smokeLayer.appendChild(node);
    });

    [-0.44, -0.16, 0.18, 0.42].forEach(function (offset, index) {
      const sparkle = smokeLayer.ownerDocument.createElement('span');
      sparkle.className = 'placement-sparkle';
      sparkle.style.left = centerX + offset * baseSize + 'px';
      sparkle.style.top = centerY + (index % 2 === 0 ? -0.42 : 0.34) * baseSize + 'px';
      sparkle.style.setProperty('--sparkle-delay', 180 + index * 95 - elapsed + 'ms');
      smokeLayer.appendChild(sparkle);
    });
  }

  function createSmoke(smokeLayer, target, imageSrc) {
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const imageSize = Math.max(target.width, target.height, 64) * 3;
    const timerRoot = smokeLayer.ownerDocument.defaultView || root;
    const impactStartedAt = readClock();
    const previousOwner = smokeOwners.get(smokeLayer);
    if (previousOwner) previousOwner.dispose();

    const image = smokeLayer.ownerDocument.createElement('img');
    const ownership = {};
    let usedFallback = false;
    let disposed = false;
    let readinessTimer = null;

    function readClock() {
      try {
        if (timerRoot.performance && typeof timerRoot.performance.now === 'function') {
          return timerRoot.performance.now();
        }
      } catch (error) {}
      return Date.now();
    }

    function elapsedSinceImpact() {
      const elapsed = readClock() - impactStartedAt;
      return Math.min(SMOKE_DURATION_MS, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
    }

    function clearReadinessTimer() {
      if (readinessTimer === null) return;
      timerRoot.clearTimeout(readinessTimer);
      readinessTimer = null;
    }

    function removeImageListeners() {
      image.removeEventListener('error', fallbackToLegacySmoke);
      image.removeEventListener('load', markImageReady);
    }

    function disposeSmokeImage() {
      if (disposed) return;
      disposed = true;
      clearReadinessTimer();
      removeImageListeners();
      if (smokeOwners.get(smokeLayer) === ownership) smokeOwners.delete(smokeLayer);
      image.removeAttribute('src');
    }

    function fallbackToLegacySmoke(elapsedOverride) {
      if (usedFallback || disposed) return;
      if (smokeOwners.get(smokeLayer) !== ownership || image.parentNode !== smokeLayer) {
        disposeSmokeImage();
        return;
      }
      const elapsed = typeof elapsedOverride === 'number'
        ? Math.min(SMOKE_DURATION_MS, Math.max(0, elapsedOverride))
        : elapsedSinceImpact();
      usedFallback = true;
      disposeSmokeImage();
      createLegacySmoke(smokeLayer, target, elapsed);
    }

    function markImageReady() {
      if (disposed) return;
      if (smokeOwners.get(smokeLayer) !== ownership || image.parentNode !== smokeLayer) {
        disposeSmokeImage();
        return;
      }
      clearReadinessTimer();
      removeImageListeners();
    }

    smokeLayer.replaceChildren();
    image.className = 'placement-smoke-image';
    image.alt = '';
    image.draggable = false;
    image.decoding = 'sync';
    image.loading = 'eager';
    image.style.left = centerX + 'px';
    image.style.top = centerY + 'px';
    image.style.setProperty('--smoke-image-size', imageSize + 'px');
    ownership.dispose = disposeSmokeImage;
    smokeOwners.set(smokeLayer, ownership);
    image.dispose = disposeSmokeImage;
    image.addEventListener('error', fallbackToLegacySmoke, { once: true });
    image.addEventListener('load', markImageReady, { once: true });
    image.src = imageSrc === undefined ? SMOKE_IMAGE_SRC : imageSrc;
    smokeLayer.appendChild(image);
    readinessTimer = timerRoot.setTimeout(fallbackToLegacySmoke, SMOKE_READINESS_TIMEOUT_MS);
    if (image.complete) {
      if (image.naturalWidth > 0) markImageReady();
      else fallbackToLegacySmoke(0);
    }

    return image;
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
    const targetSlot = relativeRect(targetElement, layerRect);
    const targetVisual = options.targetVisualElement
      ? relativeRect(options.targetVisualElement, layerRect)
      : createFallbackTarget(source, targetSlot);
    const sourceStyle = root.getComputedStyle(sourceElement);
    const targetStyle = options.targetVisualElement
      ? root.getComputedStyle(options.targetVisualElement)
      : null;
    const geometry = createFlightGeometry(source, targetVisual, {
      sourceMirrored: isHorizontallyMirrored(sourceStyle.transform, sourceStyle.scale),
      targetMirrored: targetStyle
        ? isHorizontallyMirrored(targetStyle.transform, targetStyle.scale)
        : false,
    });
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
    const stopStarTrailAnimation = startStarTrail(options.particleCanvas, layer, flyer);
    trailPath.setAttribute('d', geometry.path);
    const pathLength = trailPath.getTotalLength();
    trailPath.style.strokeDasharray = pathLength;
    trailPath.style.strokeDashoffset = pathLength;
    let smokeImage = null;

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
      stopStarTrailAnimation();
      impact();
      flyer.style.opacity = '0';
      smokeImage = createSmoke(smokeLayer, targetSlot);
      smokeLayer.offsetWidth;
      smokeLayer.classList.add('is-active');
      await Promise.allSettled([trailAnimation.finished, wait(SMOKE_DURATION_MS)]);
      await wait(TOTAL_DURATION_MS - FLIGHT_DURATION_MS - SMOKE_DURATION_MS);
    } finally {
      stopStarTrailAnimation(true);
      impact();
      flyer.remove();
      if (smokeImage) smokeImage.dispose();
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
    SMOKE_IMAGE_SRC: SMOKE_IMAGE_SRC,
    SMOKE_READINESS_TIMEOUT_MS: SMOKE_READINESS_TIMEOUT_MS,
    createEmissionPoints: createEmissionPoints,
    particleOpacity: particleOpacity,
    particleScale: particleScale,
    updateParticle: updateParticle,
    startStarTrail: startStarTrail,
    isHorizontallyMirrored: isHorizontallyMirrored,
    orientationAngles: orientationAngles,
    createFlightGeometry: createFlightGeometry,
    createFallbackTarget: createFallbackTarget,
    createSmoke: createSmoke,
    playPlacementMotion: playPlacementMotion,
  };
});
