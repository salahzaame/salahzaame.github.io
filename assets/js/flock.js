// Ink flock: a boids simulation drawn like pen marks on paper.
// Each bird steers by separation, alignment and cohesion with its
// neighbours; nearby birds are linked like points in a latent space.
// A few "signal" birds carry the accent color and leave a short trail.
(function () {
  var canvas = document.querySelector('[data-flock]');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var countLabel = document.querySelector('[data-flock-count]');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var P = {
    view: 80,          // neighbour radius
    separation: 30,    // personal space
    link: 80,          // draw a latent link below this distance
    flee: 130,         // cursor influence radius
    maxSpeed: 2.3,
    minSpeed: 1.0,
    alignW: 0.055,
    cohesionW: 0.0032,
    separationW: 0.11,
    edge: 70,
    trail: 18
  };
  var VIEW2 = P.view * P.view;
  var SEP2 = P.separation * P.separation;
  var LINK2 = P.link * P.link;
  var FLEE2 = P.flee * P.flee;

  var W = 0, H = 0, tick = 0, running = false, visible = true, raf = 0;
  var birds = [];
  var colors = {};
  var pointer = { x: -1e4, y: -1e4 };

  function readColors() {
    var s = getComputedStyle(document.documentElement);
    colors.ink = s.getPropertyValue('--ink-soft').trim() || '#22333B';
    colors.line = s.getPropertyValue('--muted').trim() || '#5E503F';
    colors.accent = s.getPropertyValue('--accent').trim() || '#D35400';
  }

  function spawn() {
    var a = Math.random() * Math.PI * 2;
    var speed = 1.2 + Math.random();
    var signal = Math.random() < 0.07;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 0.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      signal: signal,
      trail: signal ? [] : null
    };
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var target = Math.round(Math.min(140, Math.max(45, (W * H) / 9500)));
    while (birds.length < target) birds.push(spawn());
    birds.length = target;
    if (countLabel) countLabel.textContent = 'n=' + target;
    if (!running) draw();
  }

  function step() {
    var n = birds.length;
    for (var i = 0; i < n; i++) {
      var b = birds[i];
      var ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, count = 0;

      for (var j = 0; j < n; j++) {
        if (i === j) continue;
        var o = birds[j];
        var dx = o.x - b.x, dy = o.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < VIEW2) {
          count++;
          ax += o.vx; ay += o.vy;
          cx += o.x; cy += o.y;
          if (d2 < SEP2) {
            var d = Math.sqrt(d2) || 1;
            sx -= dx / d; sy -= dy / d;
          }
        }
      }

      if (count) {
        b.vx += (ax / count - b.vx) * P.alignW + (cx / count - b.x) * P.cohesionW;
        b.vy += (ay / count - b.vy) * P.alignW + (cy / count - b.y) * P.cohesionW;
      }
      b.vx += sx * P.separationW;
      b.vy += sy * P.separationW;

      // Scatter away from the cursor like a startled flock
      var px = b.x - pointer.x, py = b.y - pointer.y;
      var pd2 = px * px + py * py;
      if (pd2 < FLEE2) {
        var pd = Math.sqrt(pd2) || 1;
        var force = (1 - pd / P.flee) * 0.55;
        b.vx += (px / pd) * force;
        b.vy += (py / pd) * force;
      }

      // Soft walls keep the flock on the page
      if (b.x < P.edge) b.vx += 0.05;
      if (b.x > W - P.edge) b.vx -= 0.05;
      if (b.y < P.edge) b.vy += 0.05;
      if (b.y > H - P.edge) b.vy -= 0.05;

      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      var clamped = Math.min(P.maxSpeed, Math.max(P.minSpeed, speed));
      b.vx = (b.vx / speed) * clamped;
      b.vy = (b.vy / speed) * clamped;

      b.x += b.vx;
      b.y += b.vy;

      if (b.trail) {
        b.trail.push(b.x, b.y);
        if (b.trail.length > P.trail * 2) b.trail.splice(0, 2);
      }
    }
    tick++;
  }

  function drawBird(b, color) {
    var angle = Math.atan2(b.vy, b.vx);
    var flap = 0.55 + 0.45 * Math.sin(tick * 0.22 + b.phase);
    var s = b.size * 1.15;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -5.5 * flap);
    ctx.lineTo(-1.6, 0);
    ctx.lineTo(-4, 5.5 * flap);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var n = birds.length;

    // Latent links between close neighbours
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = colors.line;
    for (var i = 0; i < n; i++) {
      var a = birds[i];
      for (var j = i + 1; j < n; j++) {
        var b = birds[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          ctx.globalAlpha = (1 - Math.sqrt(d2) / P.link) * 0.28;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Signal trails
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var t = birds[i].trail;
      if (!t || t.length < 4) continue;
      for (var k = 2; k < t.length; k += 2) {
        ctx.globalAlpha = (k / t.length) * 0.5;
        ctx.beginPath();
        ctx.moveTo(t[k - 2], t[k - 1]);
        ctx.lineTo(t[k], t[k + 1]);
        ctx.stroke();
      }
    }

    // Birds
    for (i = 0; i < n; i++) {
      var bird = birds[i];
      ctx.globalAlpha = bird.signal ? 1 : 0.78;
      drawBird(bird, bird.signal ? colors.accent : colors.ink);
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    if (!running) return;
    step();
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Pointer is tracked on window because the hero text sits above the canvas
  window.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  }, { passive: true });
  document.addEventListener('pointerleave', function () {
    pointer.x = pointer.y = -1e4;
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  document.addEventListener('themechange', function () {
    readColors();
    if (!running) draw();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }).observe(canvas);
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  readColors();
  resize();

  if (reduceMotion) {
    // Settle the flock into formation, then show a single still frame
    for (var s = 0; s < 240; s++) step();
    draw();
  } else {
    start();
  }
})();
