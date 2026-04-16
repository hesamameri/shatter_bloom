/**
 * Shatter Bloom — Cinematic Edition
 * A dramatic wall-fracture effect with branching cracks, volumetric light,
 * dust particles, screen-shake, and physics-driven shattering.
 *
 * (c) 2025 Hesam Ameri — MIT License
 */
(function () {
  "use strict";

  /* ── defaults ───────────────────────────────────────────────── */
  const DEFAULTS = {
    duration: 2,              // total effect duration in MINUTES
    fractureCount: 55,        // number of Voronoi fragment cells
    crackWidth: 1.8,          // base crack-line width in px
    lightColor: "#fffbe6",    // colour of the light behind the wall
    lightIntensity: 1.0,      // 0–1, brightness of the reveal glow
    delaySpread: 0.35,        // 0–1, per-fragment timing randomness
    gravity: 420,             // px/s² for falling fragments
    rotationSpeed: 1.8,       // max random spin (rad/s) per fragment

    /* phase ratios (should sum ≤ 1.0; remainder = final reveal hold) */
    crackPhase: 0.30,         // slow crack propagation
    rumblePhase: 0.12,        // tension build — light pulses, micro-shake
    lightPhase: 0.18,         // light floods through cracks
    breakPhase: 0.30,         // fragments shatter out
    /* remaining 0.10 → bright reveal hold */

    impactPoint: null,        // {x:0-1, y:0-1} or null for auto-centre
    crackBranches: 7,         // primary crack arms radiating from impact
    crackDepth: 5,            // max branching recursion depth
    dustCount: 120,           // number of dust / debris particles
    shakeIntensity: 1.0,      // screen-shake multiplier (0 = off)
    lightRayCount: 18,        // volumetric light rays through cracks
    impactStrength: 1.0,      // 0–2, visual strength of impact pulses
    impactBPM: 90,            // beats per minute — sync to your track's tempo
    autoPlay: true,
    loop: false,
    easing: "easeOutCubic"
  };

  /* ── easings ────────────────────────────────────────────────── */
  const EASINGS = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutCubic: t => (--t) * t * t + 1,
    easeInCubic: t => t * t * t,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    easeInOutBack: t => {
      const c = 1.70158 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
    }
  };

  /* ── helpers ────────────────────────────────────────────────── */
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  /* ── branching crack tree ──────────────────────────────────── */
  function buildCrackTree(w, h, opts) {
    const ix = opts.impactPoint ? opts.impactPoint.x * w : w * rand(0.35, 0.65);
    const iy = opts.impactPoint ? opts.impactPoint.y * h : h * rand(0.35, 0.65);
    const segments = [];
    const maxLen = Math.sqrt(w * w + h * h);

    function branch(x, y, angle, depth, lenBudget, delay) {
      if (depth > opts.crackDepth || lenBudget <= 4) return;

      // segment length decreases with depth, with randomness
      const segLen = clamp(lenBudget * rand(0.18, 0.35), 8, lenBudget * 0.5);
      const jitter = rand(-0.35, 0.35);
      const a = angle + jitter;
      const ex = x + Math.cos(a) * segLen;
      const ey = y + Math.sin(a) * segLen;

      // distance from impact → normalised reveal order
      const dist = Math.sqrt((x - ix) * (x - ix) + (y - iy) * (y - iy));
      const normDist = dist / maxLen;

      segments.push({
        x1: x, y1: y, x2: ex, y2: ey,
        depth,
        reveal: clamp(normDist + delay + rand(0, 0.08), 0, 1),
        width: Math.max(0.5, 1.8 - depth * 0.25)
      });

      const remaining = lenBudget - segLen;

      // continue main line
      branch(ex, ey, a, depth, remaining, delay + 0.02);

      // probabilistic side-branching
      if (depth < opts.crackDepth && Math.random() < 0.55 - depth * 0.08) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const branchAngle = a + side * rand(0.4, 1.1);
        branch(ex, ey, branchAngle, depth + 1, remaining * rand(0.4, 0.7), delay + 0.04);
      }

      // occasional secondary fork
      if (depth < 2 && Math.random() < 0.25) {
        const branchAngle = a + (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.3);
        branch(ex, ey, branchAngle, depth + 2, remaining * rand(0.25, 0.45), delay + 0.06);
      }
    }

    // primary arms radiating outward
    for (let i = 0; i < opts.crackBranches; i++) {
      const angle = (Math.PI * 2 * i) / opts.crackBranches + rand(-0.3, 0.3);
      branch(ix, iy, angle, 0, maxLen * rand(0.6, 1.0), 0);
    }

    segments.sort((a, b) => a.reveal - b.reveal);
    return { segments, impactX: ix, impactY: iy };
  }

  /* ── Voronoi cells (brute-force, fine for ≤ 200) ───────────── */
  function generateVoronoiCells(w, h, count, impactX, impactY, crackSegments) {
    const seeds = [];
    const minSep = Math.min(w, h) / (Math.sqrt(count) * 1.2); // min distance between seeds
    const minSep2 = minSep * minSep;

    function tooClose(px, py) {
      for (let i = seeds.length - 1; i >= Math.max(0, seeds.length - 40); i--) {
        const dx = seeds[i].x - px, dy = seeds[i].y - py;
        if (dx * dx + dy * dy < minSep2) return true;
      }
      return false;
    }

    // 1) seed along crack segments — place points on both sides of each crack
    if (crackSegments && crackSegments.length > 0) {
      const spacing = minSep * 0.9;
      for (const seg of crackSegments) {
        const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) continue;
        const nx = -dy / len, ny = dx / len; // normal to segment
        const steps = Math.max(1, Math.floor(len / spacing));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const mx = lerp(seg.x1, seg.x2, t);
          const my = lerp(seg.y1, seg.y2, t);
          // place a seed on each side of the crack
          const offset = minSep * 0.4 + rand(0, minSep * 0.2);
          for (const side of [-1, 1]) {
            const px = clamp(mx + nx * side * offset + rand(-2, 2), 0, w);
            const py = clamp(my + ny * side * offset + rand(-2, 2), 0, h);
            if (seeds.length < count && !tooClose(px, py)) {
              seeds.push({ x: px, y: py });
            }
          }
        }
      }
    }

    // 2) fill remaining budget with random points
    let attempts = 0;
    while (seeds.length < count && attempts < count * 8) {
      attempts++;
      const px = rand(0, w), py = rand(0, h);
      if (!tooClose(px, py)) seeds.push({ x: px, y: py });
    }

    const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    const ownership = new Int16Array(cols * rows);

    for (let gy = 0; gy < h; gy += step) {
      for (let gx = 0; gx < w; gx += step) {
        let best = 0, bestD = Infinity;
        for (let i = 0; i < count; i++) {
          const dx = gx - seeds[i].x, dy = gy - seeds[i].y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
        ownership[(gy / step | 0) * cols + (gx / step | 0)] = best;
      }
    }

    const cellPoints = Array.from({ length: count }, () => []);
    for (let gy = 0; gy < h; gy += step) {
      for (let gx = 0; gx < w; gx += step) {
        const ci = (gy / step | 0) * cols + (gx / step | 0);
        cellPoints[ownership[ci]].push({ x: gx, y: gy });
      }
    }

    const cells = [];
    const maxDist = Math.sqrt(w * w + h * h);
    for (let i = 0; i < count; i++) {
      const pts = cellPoints[i];
      if (pts.length < 3) continue;
      const hull = convexHull(pts);
      const cx = seeds[i].x, cy = seeds[i].y;
      const distFromImpact = Math.sqrt((cx - impactX) ** 2 + (cy - impactY) ** 2);
      cells.push({ cx, cy, hull, distFromImpact, normDist: distFromImpact / maxDist });
    }
    return cells;
  }

  function convexHull(points) {
    points = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (points.length <= 1) return points;
    const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    const lower = [];
    for (const p of points) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  /* ── dust / debris particles ───────────────────────────────── */
  function createDustParticles(count, crackSegs, w, h) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      // spawn along random crack segment
      const seg = crackSegs[Math.floor(Math.random() * crackSegs.length)];
      const tAlongSeg = Math.random();
      const px = lerp(seg.x1, seg.x2, tAlongSeg) + rand(-3, 3);
      const py = lerp(seg.y1, seg.y2, tAlongSeg) + rand(-3, 3);

      particles.push({
        x: px, y: py,
        vx: rand(-15, 15),
        vy: rand(8, 60),
        size: rand(0.8, 3.2),
        alpha: rand(0.3, 0.85),
        life: rand(0.3, 1.0),
        spawnT: seg.reveal + rand(0, 0.15),
        drift: rand(-8, 8),
        rotSpeed: rand(-3, 3)
      });
    }
    return particles;
  }

  /* ── volumetric light rays ─────────────────────────────────── */
  function createLightRays(count, impactX, impactY, w, h) {
    const rays = [];
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const length = rand(0.3, 1.0) * Math.max(w, h) * 0.8;
      rays.push({
        angle,
        length,
        width: rand(6, 40),
        alpha: rand(0.04, 0.14),
        pulsePhase: rand(0, Math.PI * 2),
        pulseSpeed: rand(0.5, 2.0)
      });
    }
    return rays;
  }

  /* ── main class ─────────────────────────────────────────────── */
  class BreakingWall {
    constructor(target, opts) {
      this.img = typeof target === "string" ? document.querySelector(target) : target;
      if (!this.img) throw new Error("ShatterBloom: target not found");

      this.opts = Object.assign({}, DEFAULTS, opts);
      this._parseDataset();

      this._running = false;
      this._startTime = 0;
      this._raf = null;
      this._built = false;
      this._destroyed = false;

      this._onImageReady(() => this._init());
    }

    /* — public API — */
    play() {
      if (this._destroyed) return;
      if (!this._built) { this._pendingPlay = true; return; }
      this._running = true;
      this._startTime = performance.now();
      this._canvas.style.display = "";
      this._tick();
    }

    pause() { this._running = false; if (this._raf) cancelAnimationFrame(this._raf); }

    reset() {
      this.pause();
      this._startTime = 0;
      if (this._canvas) {
        const ctx = this._canvas.getContext("2d");
        ctx.clearRect(0, 0, this._w, this._h);
        this._canvas.style.display = "none";
      }
      if (this._wrapper) this._wrapper.style.transform = "";
      this.img.style.visibility = "";
    }

    destroy() {
      this.pause();
      this._destroyed = true;
      if (this._canvas && this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
      if (this._wrapper) {
        this._wrapper.style.transform = "";
        const parent = this._wrapper.parentNode;
        if (parent) {
          parent.insertBefore(this.img, this._wrapper);
          parent.removeChild(this._wrapper);
        }
      }
      this.img.style.visibility = "";
      delete this.img._shatterBloom;
    }

    updateOptions(newOpts) {
      Object.assign(this.opts, newOpts);
      this._rebuild();
    }

    /* — internals — */
    _parseDataset() {
      if (!this.img.dataset) return;
      const map = {
        "wallDuration": "duration",
        "wallFractureCount": "fractureCount",
        "wallCrackWidth": "crackWidth",
        "wallLightColor": "lightColor",
        "wallLightIntensity": "lightIntensity",
        "wallDelaySpread": "delaySpread",
        "wallGravity": "gravity",
        "wallRotationSpeed": "rotationSpeed",
        "wallCrackPhase": "crackPhase",
        "wallRumblePhase": "rumblePhase",
        "wallLightPhase": "lightPhase",
        "wallBreakPhase": "breakPhase",
        "wallCrackBranches": "crackBranches",
        "wallCrackDepth": "crackDepth",
        "wallDustCount": "dustCount",
        "wallShakeIntensity": "shakeIntensity",
        "wallLightRayCount": "lightRayCount",
        "wallImpactStrength": "impactStrength",
        "wallImpactBpm": "impactBPM",
        "wallAutoPlay": "autoPlay",
        "wallLoop": "loop",
        "wallEasing": "easing"
      };
      for (const [dataKey, optKey] of Object.entries(map)) {
        const v = this.img.dataset[dataKey];
        if (v == null) continue;
        if (v === "true") this.opts[optKey] = true;
        else if (v === "false") this.opts[optKey] = false;
        else if (!isNaN(Number(v))) this.opts[optKey] = Number(v);
        else this.opts[optKey] = v;
      }
    }

    _onImageReady(cb) {
      if (this.img.complete && this.img.naturalWidth) { cb(); return; }
      this.img.addEventListener("load", cb, { once: true });
    }

    _init() {
      const img = this.img;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      this._wrapper = document.createElement("div");
      this._wrapper.className = "shatter-bloom-wrap";
      this._wrapper.style.cssText = `position:relative;display:inline-block;width:${img.clientWidth || w}px;height:${img.clientHeight || h}px;overflow:hidden;`;
      img.parentNode.insertBefore(this._wrapper, img);
      this._wrapper.appendChild(img);
      img.style.cssText += ";display:block;width:100%;height:100%;";

      this._canvas = document.createElement("canvas");
      this._canvas.className = "shatter-bloom-canvas";
      this._canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;";
      this._wrapper.appendChild(this._canvas);

      this._srcCanvas = document.createElement("canvas");

      this._rebuild();
      this._built = true;
      img._shatterBloom = this;

      if (this.opts.autoPlay || this._pendingPlay) this.play();
    }

    _rebuild() {
      const rect = this._wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      this._w = w; this._h = h; this._dpr = dpr;

      this._canvas.width = w;
      this._canvas.height = h;
      this._srcCanvas.width = w;
      this._srcCanvas.height = h;

      const sctx = this._srcCanvas.getContext("2d");
      sctx.drawImage(this.img, 0, 0, w, h);

      // build crack tree
      this._crackTree = buildCrackTree(w, h, this.opts);
      const ix = this._crackTree.impactX;
      const iy = this._crackTree.impactY;

      // build Voronoi cells seeded along crack tree
      this._cells = generateVoronoiCells(w, h, this.opts.fractureCount, ix, iy, this._crackTree.segments);

      // per-cell break physics — cells near impact break first
      for (const cell of this._cells) {
        const normD = cell.normDist;
        cell.breakDelay = normD * (1 - this.opts.delaySpread) + rand(0, this.opts.delaySpread) * normD;
        // velocity away from impact
        const ax = cell.cx - ix, ay = cell.cy - iy;
        const dist = Math.sqrt(ax * ax + ay * ay) || 1;
        const push = rand(60, 200);
        cell.vx = (ax / dist) * push + rand(-40, 40);
        cell.vy = (ay / dist) * push * 0.5 + rand(-180, -30);
        cell.rotSpeed = rand(-this.opts.rotationSpeed, this.opts.rotationSpeed);
        // 3D-ish depth: small z-drift gives perspective scale
        cell.zSpeed = rand(0.3, 1.2);
      }

      // dust particles
      this._dust = createDustParticles(this.opts.dustCount, this._crackTree.segments, w, h);

      // light rays
      this._rays = createLightRays(this.opts.lightRayCount, ix, iy, w, h);
    }

    /* — duration is in MINUTES → convert to ms internally — */
    _durationMs() { return this.opts.duration * 60 * 1000; }

    _tick() {
      if (!this._running) return;
      const elapsed = performance.now() - this._startTime;
      const totalMs = this._durationMs();
      let t = clamp(elapsed / totalMs, 0, 1);

      this._drawFrame(t, elapsed / 1000);

      if (t >= 1) {
        if (this.opts.loop) {
          this._startTime = performance.now();
          this._rebuild();
          this._raf = requestAnimationFrame(() => this._tick());
        } else {
          this._running = false;
          this.img.dispatchEvent(new CustomEvent("shatterbloom:done"));
        }
        return;
      }
      this._raf = requestAnimationFrame(() => this._tick());
    }

    _drawFrame(t, elapsedSec) {
      const ctx = this._canvas.getContext("2d");
      const w = this._w, h = this._h;
      const o = this.opts;
      const ease = EASINGS[o.easing] || EASINGS.easeOutCubic;
      const dpr = this._dpr;
      const tree = this._crackTree;
      const ix = tree.impactX, iy = tree.impactY;

      /* phase boundaries */
      const p1 = o.crackPhase;
      const p2 = p1 + o.rumblePhase;
      const p3 = p2 + o.lightPhase;
      const p4 = p3 + o.breakPhase;

      /* per-phase progress 0→1 */
      const crackT   = smoothstep(0,  p1, t);
      const rumbleT  = smoothstep(p1, p2, t);
      const lightT   = smoothstep(p2, p3, t);
      const breakT   = smoothstep(p3, p4, t);
      const revealT  = smoothstep(p4, 1,  t);

      const rgb = hexToRgb(o.lightColor);
      const I = o.lightIntensity;

      ctx.clearRect(0, 0, w, h);
      if (t <= 0) return;
      this._canvas.style.display = "";

      const breaking = t > p3;
      this.img.style.visibility = breaking ? "hidden" : "";

      /* ── impact pulse timing (continuous) ── */
      let hitEnvelope = 0;
      const impactActive = o.impactStrength > 0 && t <= p3;
      if (impactActive) {
        // continuous sine-based pulse synced to BPM
        const hz = o.impactBPM / 60;
        const raw = Math.sin(elapsedSec * hz * Math.PI * 2);
        // shape into a sharp positive pulse (0→1) from the sine wave
        hitEnvelope = Math.pow(clamp(raw, 0, 1), 1.6);
        // grow intensity as cracks deepen
        hitEnvelope *= clamp(crackT * 2, 0.15, 1) * o.impactStrength;
      }

      /* ── screen shake (now includes impact hits) ── */
      if ((o.shakeIntensity > 0 || impactActive) && t > 0.001) {
        let shakeAmt = 0;
        // impact pulse shake
        if (hitEnvelope > 0.05) {
          shakeAmt += hitEnvelope * 4 * o.impactStrength * (o.shakeIntensity * 0.5 + 0.5);
        }
        // subtle micro-shake during rumble
        if (rumbleT > 0 && rumbleT < 1) {
          shakeAmt += Math.sin(elapsedSec * 35) * 1.5 * rumbleT * o.shakeIntensity;
        }
        // bigger hit on break start
        if (breakT > 0 && breakT < 0.15) {
          shakeAmt += (1 - breakT / 0.15) * 6 * o.shakeIntensity * Math.sin(elapsedSec * 60);
        }
        if (Math.abs(shakeAmt) > 0.1) {
          const sx = Math.sin(elapsedSec * 47) * shakeAmt;
          const sy = Math.cos(elapsedSec * 53) * shakeAmt * 0.7;
          this._wrapper.style.transform = `translate(${sx / dpr}px,${sy / dpr}px)`;
        } else {
          this._wrapper.style.transform = "";
        }
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 0 — impact pulse shockwave rings
         ══════════════════════════════════════════════════════════ */
      if (hitEnvelope > 0.02) {
        ctx.save();
        // expanding ring
        const maxR = Math.max(w, h) * 0.35;
        const ringR = maxR * (1 - hitEnvelope * 0.6); // ring expands as hit decays
        const ringW = (6 + hitEnvelope * 18) * dpr;
        const ringA = hitEnvelope * 0.45 * I;

        // outer shockwave ring
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${ringA * 0.6})`;
        ctx.lineWidth = ringW;
        ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${ringA * 0.4})`;
        ctx.shadowBlur = 20 * dpr * hitEnvelope;
        ctx.beginPath();
        ctx.arc(ix, iy, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // inner bright flash at impact center
        const flashR = 12 * dpr + hitEnvelope * 30 * dpr;
        const flashA = hitEnvelope * 0.5 * I;
        const fGrd = ctx.createRadialGradient(ix, iy, 0, ix, iy, flashR);
        fGrd.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${flashA})`);
        fGrd.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},${flashA * 0.3})`);
        fGrd.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        ctx.shadowBlur = 0;
        ctx.fillStyle = fGrd;
        ctx.beginPath();
        ctx.arc(ix, iy, flashR, 0, Math.PI * 2);
        ctx.fill();

        // secondary ripple ring (delayed)
        if (hitEnvelope > 0.3) {
          const rip = (hitEnvelope - 0.3) / 0.7;
          const ripR = ringR * 0.6 * (1 + rip * 0.4);
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${rip * 0.2 * I})`;
          ctx.lineWidth = ringW * 0.4;
          ctx.shadowBlur = 8 * dpr * rip;
          ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${rip * 0.15 * I})`;
          ctx.beginPath();
          ctx.arc(ix, iy, ripR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 1 — bright light background
         ══════════════════════════════════════════════════════════ */
      const bgGlow = clamp(
        lightT * 0.2 +
        breakT * 0.6 +
        revealT * 0.8,
        0, 1
      ) * I;

      // subtle pulsing during rumble only
      let pulseGlow = 0;
      if (rumbleT > 0 && lightT === 0) {
        pulseGlow = Math.sin(elapsedSec * 3.5) * 0.04 * rumbleT * I;
      }

      const totalBg = clamp(bgGlow + pulseGlow, 0, 1);
      if (totalBg > 0.005) {
        // wide sun glow
        const grd = ctx.createRadialGradient(ix, iy, 0, ix, iy, Math.max(w, h) * 1.0);
        grd.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(totalBg, 1)})`);
        grd.addColorStop(0.25, `rgba(${rgb.r},${rgb.g},${rgb.b},${totalBg * 0.65})`);
        grd.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},${totalBg * 0.25})`);
        grd.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},${totalBg * 0.05})`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // hot white core (sun disk) — only during break and reveal
        if (totalBg > 0.5) {
          const coreStr = (totalBg - 0.5) * 2; // 0→1 over the top half
          const coreR = Math.max(w, h) * 0.15 * coreStr;
          const core = ctx.createRadialGradient(ix, iy, 0, ix, iy, coreR);
          core.addColorStop(0, `rgba(255,255,255,${Math.min(coreStr * 0.8, 0.9)})`);
          core.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${coreStr * 0.4})`);
          core.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
          ctx.fillStyle = core;
          ctx.fillRect(0, 0, w, h);
        }
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 2 — volumetric light rays (from light phase onward)
         ══════════════════════════════════════════════════════════ */
      const rayAlpha = clamp(lightT * 0.8 + breakT * 0.5 + revealT * 0.2, 0, 1) * I;
      if (rayAlpha > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (const ray of this._rays) {
          const pulse = 1 + Math.sin(elapsedSec * ray.pulseSpeed + ray.pulsePhase) * 0.35;
          const a = Math.min(ray.alpha * rayAlpha * pulse * 2.5, 0.7);
          if (a < 0.005) continue;

          const len = ray.length * (0.5 + rayAlpha * 0.5);
          const ex = ix + Math.cos(ray.angle) * len;
          const ey = iy + Math.sin(ray.angle) * len;

          const grad = ctx.createLinearGradient(ix, iy, ex, ey);
          grad.addColorStop(0, `rgba(255,255,255,${a * 0.7})`);
          grad.addColorStop(0.15, `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.6})`);
          grad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.25})`);
          grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = ray.width * dpr * (0.8 + rayAlpha * 0.8);
          ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.4})`;
          ctx.shadowBlur = 12 * dpr;
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 3 — wall fragments (break phase onward)
         ══════════════════════════════════════════════════════════ */
      if (breaking) {
        const totalDurSec = o.duration * 60;
        const breakDurSec = totalDurSec * o.breakPhase;

        for (const cell of this._cells) {
          const cellBreakT = clamp((breakT - cell.breakDelay) / (1 - cell.breakDelay + 0.001), 0, 1);
          const eb = ease(cellBreakT);
          if (eb >= 0.99) continue;

          ctx.save();

          const dt = cellBreakT * breakDurSec;
          const dx = cell.vx * dt * eb;
          const dy = (cell.vy * dt + 0.5 * o.gravity * dt * dt) * eb;
          const rot = cell.rotSpeed * dt * eb;
          // perspective-ish scale shrink as fragment "falls away"
          const scale = 1 - eb * cell.zSpeed * 0.35;

          ctx.globalAlpha = clamp(1 - eb * 1.1, 0, 1);
          ctx.translate(cell.cx + dx, cell.cy + dy);
          ctx.rotate(rot);
          ctx.scale(scale, scale);
          ctx.translate(-cell.cx, -cell.cy);

          const hull = cell.hull;
          if (hull.length > 2) {
            ctx.beginPath();
            ctx.moveTo(hull[0].x, hull[0].y);
            for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
            ctx.closePath();
            ctx.clip();
          }

          ctx.drawImage(this._srcCanvas, 0, 0);

          // glowing edges on fragment — blazing sun rim
          if (cellBreakT < 0.6) {
            const eg = (1 - cellBreakT / 0.6) * 0.85 * I;
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${eg})`;
            ctx.lineWidth = o.crackWidth * 4 * dpr;
            ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(eg * 0.95, 1)})`;
            ctx.shadowBlur = 28 * dpr;
            if (hull.length > 2) {
              ctx.beginPath();
              ctx.moveTo(hull[0].x, hull[0].y);
              for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
              ctx.closePath();
              ctx.stroke();
            }
            ctx.shadowBlur = 0;
          }

          ctx.restore();
        }
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 4 — crack lines
         ══════════════════════════════════════════════════════════ */
      if (crackT > 0) {
        ctx.save();
        const fadeMul = breaking ? clamp(1 - breakT * 2, 0, 1) : 1;
        if (fadeMul > 0) {
          for (const seg of tree.segments) {
            // glass-like: segment snaps in fully the instant crackT passes its reveal time
            if (crackT < seg.reveal) continue;

            const sx = seg.x1, sy = seg.y1;
            const ex = seg.x2, ey = seg.y2;

            // dark fissure — full opacity immediately
            ctx.strokeStyle = `rgba(20,15,10,${0.9 * fadeMul})`;
            ctx.lineWidth = seg.width * o.crackWidth * dpr;
            ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

            // secondary thin highlight line for depth
            ctx.strokeStyle = `rgba(60,50,40,${0.35 * fadeMul})`;
            ctx.lineWidth = seg.width * o.crackWidth * dpr * 0.4;
            ctx.beginPath(); ctx.moveTo(sx + dpr, sy + dpr); ctx.lineTo(ex + dpr, ey + dpr); ctx.stroke();

            // light glow through crack — proportional to crack width
            const glowPhaseT = clamp(rumbleT * 0.15 + lightT * 0.85, 0, 1);
            if (glowPhaseT > 0) {
              const cw = seg.width * o.crackWidth; // actual crack width
              const glowStr = Math.min(glowPhaseT * 0.7 * I * fadeMul, 1);
              const pulse = 1 + (rumbleT > 0 && lightT === 0
                ? Math.sin(elapsedSec * 4 + seg.reveal * 20) * 0.25 * rumbleT
                : 0);

              // bright core line — width scales with crack
              ctx.strokeStyle = `rgba(255,255,255,${glowStr * pulse * 0.5})`;
              ctx.lineWidth = cw * 1.8 * dpr;
              ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${glowStr * pulse * 0.7})`;
              ctx.shadowBlur = cw * 6 * dpr * glowPhaseT;
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

              // wider coloured halo — also proportional
              ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${glowStr * pulse * 0.5})`;
              ctx.lineWidth = cw * 3.5 * dpr;
              ctx.shadowBlur = cw * 10 * dpr * glowPhaseT;
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
              ctx.shadowBlur = 0;
            }
          }
        }
        ctx.restore();
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 5 — dust / debris particles
         ══════════════════════════════════════════════════════════ */
      if (crackT > 0.15) {
        ctx.save();
        for (const p of this._dust) {
          const pt = clamp((t - p.spawnT * p1) / ((1 - p.spawnT * p1) * p.life + 0.001), 0, 1);
          if (pt <= 0 || pt >= 1) continue;

          const age = pt * o.duration * 60 * p.life;
          const px = p.x + p.vx * age + Math.sin(age * 0.7 + p.drift) * p.drift;
          const py = p.y + p.vy * age + 0.5 * 30 * age * age;
          const pa = p.alpha * (1 - pt) * clamp(pt * 8, 0, 1);

          // tiny bright specks
          const brightness = (lightT > 0)
            ? lerp(0.45, 1.0, lightT) * I
            : 0.45;

          ctx.globalAlpha = pa * brightness;
          ctx.fillStyle = lightT > 0.3
            ? `rgb(${rgb.r},${rgb.g},${rgb.b})`
            : "#a09080";

          ctx.beginPath();
          ctx.arc(px, py, p.size * dpr, 0, Math.PI * 2);
          ctx.fill();

          // glow halo on bright particles
          if (lightT > 0.2 && p.size > 1.5) {
            ctx.globalAlpha = pa * 0.2 * lightT * I;
            ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
            ctx.shadowBlur = 6 * dpr;
            ctx.beginPath();
            ctx.arc(px, py, p.size * dpr * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
        ctx.restore();
      }

      /* ══════════════════════════════════════════════════════════
         LAYER 6 — final bright bloom on full reveal
         ══════════════════════════════════════════════════════════ */
      if (revealT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const rv = ease(revealT);

        // pass 1: massive sun-like radial flood
        const bloom1 = Math.min(rv * 0.85 * I, 0.95);
        const grd1 = ctx.createRadialGradient(ix, iy, 0, ix, iy, Math.max(w, h) * 0.9);
        grd1.addColorStop(0, `rgba(255,255,255,${bloom1})`);
        grd1.addColorStop(0.15, `rgba(${rgb.r},${rgb.g},${rgb.b},${bloom1 * 0.8})`);
        grd1.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},${bloom1 * 0.35})`);
        grd1.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        ctx.fillStyle = grd1;
        ctx.fillRect(0, 0, w, h);

        // pass 2: hot white core that burns out
        if (rv > 0.15) {
          const bloom2 = Math.min((rv - 0.15) / 0.85 * I, 0.9);
          const coreR = Math.max(w, h) * (0.1 + rv * 0.25);
          const grd2 = ctx.createRadialGradient(ix, iy, 0, ix, iy, coreR);
          grd2.addColorStop(0, `rgba(255,255,255,${bloom2})`);
          grd2.addColorStop(0.5, `rgba(255,255,240,${bloom2 * 0.5})`);
          grd2.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
          ctx.fillStyle = grd2;
          ctx.fillRect(0, 0, w, h);
        }

        // pass 3: full-screen warm wash at end
        if (rv > 0.5) {
          const wash = (rv - 0.5) * 2 * 0.4 * I;
          ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${wash})`;
          ctx.fillRect(0, 0, w, h);
        }

        ctx.restore();
      }
    }
  }

  /* ── static API ─────────────────────────────────────────────── */
  const ShatterBloomPlugin = {
    defaults: Object.assign({}, DEFAULTS),

    fromDataset(img) { return new BreakingWall(img, {}); },

    attach(target, options) {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      if (!el) return null;
      if (el._shatterBloom) el._shatterBloom.destroy();
      return new BreakingWall(el, options);
    },

    attachAll(selector, options) {
      const els = document.querySelectorAll(selector || ".shatter-bloom");
      const instances = [];
      els.forEach(el => instances.push(ShatterBloomPlugin.attach(el, options)));
      return instances;
    },

    destroy(target) {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      if (el && el._shatterBloom) el._shatterBloom.destroy();
    }
  };

  window.ShatterBloom = ShatterBloomPlugin;

  function autoAttach() { ShatterBloomPlugin.attachAll(".shatter-bloom"); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoAttach);
  } else {
    autoAttach();
  }
})();
