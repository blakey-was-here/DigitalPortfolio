/* Flip card behaviour: click / tap / Enter / Space to flip, drag to flip,
   mouse tilt, glare, hover scale, spring physics, reduced-motion fallback. */
(function () {
  var card = document.querySelector('[data-flip-card]');
  if (!card) return;

  var rotor = card.querySelector('.flip-card__rotor');

  // Same values as the React props
  var TILT_MAX = 12;
  var HOVER_SCALE = 1.03;
  var STIFFNESS = 170;
  var DAMPING = 20;
  var DRAG_DEG_PER_PX = 0.5;
  var CLICK_THRESHOLD = 4; // px of movement before a press counts as a drag

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var keys = ['angle', 'tx', 'ty', 'scale'];
  var pos = { angle: 0, tx: 0, ty: 0, scale: 1 };
  var vel = { angle: 0, tx: 0, ty: 0, scale: 0 };
  var target = { angle: 0, tx: 0, ty: 0, scale: 1 };

  var flipped = false;
  var dragging = false;
  var moved = false;
  var startX = 0;
  var startAngle = 0;
  var running = false;
  var last = 0;

  function render() {
    rotor.style.transform =
      'rotateX(' + pos.tx + 'deg) rotateY(' + (pos.angle + pos.ty) + 'deg) scale(' + pos.scale + ')';
  }

  function step(now) {
    var dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    var moving = false;

    keys.forEach(function (k) {
      var force = -STIFFNESS * (pos[k] - target[k]) - DAMPING * vel[k];
      vel[k] += force * dt;
      pos[k] += vel[k] * dt;
      if (Math.abs(vel[k]) > 0.01 || Math.abs(pos[k] - target[k]) > 0.01) {
        moving = true;
      } else {
        pos[k] = target[k];
        vel[k] = 0;
      }
    });

    render();

    if (moving) {
      requestAnimationFrame(step);
    } else {
      running = false;
    }
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(step);
  }

  function setFlipped(value) {
    flipped = value;
    card.setAttribute('aria-pressed', String(flipped));
    if (reduced.matches) card.dataset.fade = flipped ? 'back' : 'front';
  }

  function toggle() {
    if (reduced.matches) {
      setFlipped(!flipped);
      return;
    }
    target.angle += 180; // always keep rotating the same direction
    setFlipped(Math.abs(Math.round(target.angle / 180)) % 2 === 1);
    start();
  }

  function applyReducedMotion() {
    if (reduced.matches) {
      card.dataset.fade = flipped ? 'back' : 'front';
    } else {
      delete card.dataset.fade;
      render();
    }
  }
  applyReducedMotion();
  if (reduced.addEventListener) reduced.addEventListener('change', applyReducedMotion);

  function setGlare(e) {
    var r = card.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;
    var py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--fc-gx', px * 100 + '%');
    card.style.setProperty('--fc-gy', py * 100 + '%');
    return { px: px, py: py };
  }

  card.addEventListener('pointerenter', function (e) {
    if (e.pointerType !== 'mouse' || reduced.matches) return;
    target.scale = HOVER_SCALE;
    card.style.setProperty('--fc-sheen', 1);
    start();
  });

  card.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse' || dragging) return;
    target.scale = 1;
    target.tx = 0;
    target.ty = 0;
    card.style.setProperty('--fc-sheen', 0);
    start();
  });

  card.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startAngle = target.angle;
    card.setAttribute('data-dragging', '');
    try { card.setPointerCapture(e.pointerId); } catch (err) {}
  });

  card.addEventListener('pointermove', function (e) {
    if (reduced.matches) return;

    if (dragging) {
      var dx = e.clientX - startX;
      if (Math.abs(dx) > CLICK_THRESHOLD) moved = true;
      if (moved) {
        var a = startAngle + dx * DRAG_DEG_PER_PX;
        // don't let a single drag spin more than one flip
        a = Math.max(startAngle - 180, Math.min(startAngle + 180, a));
        target.angle = a;
        pos.angle = a;
        vel.angle = 0;
        render();
      }
      return;
    }

    if (e.pointerType === 'mouse') {
      var p = setGlare(e);
      target.ty = (p.px - 0.5) * 2 * TILT_MAX;
      target.tx = -(p.py - 0.5) * 2 * TILT_MAX;
      start();
    }
  });

  function endDrag(e, cancelled) {
    if (!dragging) return;
    dragging = false;
    card.removeAttribute('data-dragging');
    try { card.releasePointerCapture(e.pointerId); } catch (err) {}

    if (!moved && !cancelled) {
      toggle();
    } else if (moved && !reduced.matches) {
      target.angle = Math.round(target.angle / 180) * 180; // snap to a face
      setFlipped(Math.abs(Math.round(target.angle / 180)) % 2 === 1);
      start();
    }

    if (e.pointerType !== 'mouse') {
      target.tx = 0;
      target.ty = 0;
      target.scale = 1;
      start();
    }
  }

  card.addEventListener('pointerup', function (e) { endDrag(e, false); });
  card.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
})();
