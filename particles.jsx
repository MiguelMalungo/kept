// Filament canopy over the hero video, with star bursts on tap.
//
// Shape echoes the light tree in assets/web/hero.mp4: fine strands fanning out
// of a single root point into a broad canopy of ribbon-like sheets. There is no
// trunk — the strands spread from the moment they leave the base.
//
// Clicking or tapping the hero sets off a starburst at that point: rays of
// particles thrown outward from a bright flash, decelerating and fading.
//
// Both geometries are built once and shared by every instance — each one only
// carries its own uniforms (phase, growth, age, fade, scale), so a burst costs
// a draw call rather than another few thousand vertices.
//
// The motion is autonomous: layered slow sines, deliberately not tied to the
// mixer or to anything else playing on the page.

const PARTICLES_CONFIG = {
  // How the canvas blends with the video underneath.
  //
  // "screen" adds light everywhere, which suits near-black footage. "lighten"
  // takes the brighter of the two per channel instead — similar, but with no
  // additive build-up. "overlay" crushes against dark backdrops and all but
  // disappears here; "plus-lighter" glows hardest.
  blendMode: "screen",

  // Opacity of the whole particle layer, applied on top of the blend mode.
  opacity: 0.27,

  // Canopy
  strands: 320,
  pointsPerStrand: 64,
  groups: 7, // ribbon fans, like the sheets in the video
  treeScale: 1.65,
  baseY: -1.55,
  intro: 2.4, // seconds for the canopy to open on first paint

  // Where each strand starts, radially. Non-zero so the foot of the tree is a
  // broad soft column like the footage, instead of every strand converging to
  // one point and stacking into a hard bright spike.
  baseRadius: [0.10, 0.62],

  // Pointer (mouse and touch) influence on the canopy.
  pointerLean: 0.30, // how far the canopy leans toward the pointer
  pointerPush: 0.34, // local shove given to strands near the pointer
  pointerRadius: 0.80, // falloff of that shove, in tree units
  pointerEase: 2.6, // how fast it follows and releases, per second

  // Star bursts (click / tap)
  burstPoints: 1600,
  burstRays: 14, // spikes; the rest of the points fill in as haze
  burstReach: [0.45, 2.3], // how far points travel, in tree units
  burstLife: 6.5, // seconds from flash to gone — a slow bloom, not a pop
  burstMax: 8, // concurrent; the oldest is retired past this
  burstScale: [0.75, 1.15], // random size range per burst
};

function HeroParticles() {
  const hostRef = React.useRef(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let cleanupFns = [];

    // Single source of truth for how the layer composites — styles.css only
    // positions it, so PARTICLES_CONFIG is the only place to change these.
    host.style.mixBlendMode = PARTICLES_CONFIG.blendMode;
    host.style.opacity = String(PARTICLES_CONFIG.opacity);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // window.__threeReady is created synchronously in index.html and resolved
    // by the module script, so this works no matter which lands first.
    const ready = window.__threeReady;
    if (!ready) return;

    ready.then((THREE) => {
      if (disposed || !host.isConnected) return;

      const C = PARTICLES_CONFIG;
      const width = () => host.clientWidth || window.innerWidth;
      const height = () => host.clientHeight || window.innerHeight;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width(), height());
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();

      const FOV = 42;
      const TAU = Math.PI * 2;
      const Z_SQUASH = 0.55; // the video reads frontal, not spherical
      const camera = new THREE.PerspectiveCamera(FOV, width() / height(), 0.1, 100);

      // Pull back far enough that the canopy fits across a narrow portrait hero
      // without shrinking to a speck on a wide desktop one. The framing targets
      // the unscaled canopy, so treeScale reads as "larger" rather than being
      // cancelled out by the camera backing off to compensate.
      const frameCamera = () => {
        const aspect = camera.aspect;
        const halfFov = Math.tan((FOV * Math.PI) / 180 / 2);
        const byHeight = 2.9 / (0.8 * 2 * halfFov);
        const byWidth = 2.8 / (0.85 * 2 * halfFov * aspect);
        camera.position.set(0, 0.15, Math.min(9, Math.max(byHeight, byWidth)));
        camera.lookAt(0, 0.15, 0);
      };
      frameCamera();

      const FRAG = `
        uniform vec3 uTeal, uGold, uPale;
        varying float vAlpha, vTone, vSpark;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;

          float soft = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.26, 0.0, d);

          vec3 col = mix(uTeal, uGold, vTone);
          col = mix(col, uPale, core * 0.55 + vSpark * 0.30);

          gl_FragColor = vec4(col, soft * vAlpha);
        }
      `;

      const palette = () => ({
        uTeal: { value: new THREE.Color("#6fc6cf") },
        uGold: { value: new THREE.Color("#d8c49a") },
        uPale: { value: new THREE.Color("#eaf9f7") },
      });

      /* ── canopy geometry: strands fanning from one root point ───────────── */

      const S = C.strands;
      const P = C.pointsPerStrand;
      const total = S * P;

      const positions = new Float32Array(total * 3);
      const aT = new Float32Array(total);
      const aSeed = new Float32Array(total);
      const aSize = new Float32Array(total);
      const aTone = new Float32Array(total);

      let n = 0;
      for (let s = 0; s < S; s++) {
        const g = s % C.groups;
        const spread = (TAU / C.groups) * 0.95;
        const theta = (g / C.groups) * TAU + (Math.random() - 0.5) * spread;

        const H = 1.5 + Math.random() * 1.35; // strand height
        const R = 0.5 + Math.random() * 1.0; // canopy reach
        const [r0lo, r0hi] = C.baseRadius;
        // Biased to the inside so the column has a dense-ish core and a soft
        // edge, rather than reading as a hollow tube.
        const r0 = r0lo + Math.pow(Math.random(), 1.7) * (r0hi - r0lo);
        const curlFreq = 3.0 + Math.random() * 5.0;
        const curlPhase = Math.random() * TAU;
        const droop = Math.random() * 0.5;
        const seed = Math.random();
        // A minority of strands take the pale gold of the fine filaments in
        // the footage; the rest are the teal of the canopy.
        const tone = Math.random() < 0.22 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.18;

        for (let p = 0; p < P; p++) {
          // The exponent pushes samples up the strand, so fewer of them land in
          // the foot of the tree — that region is where all 320 strands overlap,
          // and an even spread packs it solid. The jitter keeps the samples off
          // a shared grid; without it every strand steps in lockstep.
          const u = (p + Math.random() * 0.9) / (P - 1 + 0.9);
          const t = Math.pow(Math.min(1, u), 0.6);

          // No trunk: the strands start spreading the moment they leave the
          // base, so smoothstep runs across the whole length rather than
          // holding everything at a hair's width for the first third.
          const fan = smoothstep(0.0, 1.0, t);

          // Starts out on the base ring and opens to the full canopy reach.
          const radial = r0 + R * Math.pow(fan, 1.2);
          const curl = Math.sin(t * curlFreq + curlPhase) * 0.17 * fan;
          const r = radial + curl;

          const y = C.baseY + Math.pow(t, 0.8) * H - Math.pow(fan, 3.0) * droop;

          positions[n * 3 + 0] = Math.cos(theta) * r;
          positions[n * 3 + 1] = y;
          positions[n * 3 + 2] = Math.sin(theta) * r * Z_SQUASH;

          aT[n] = t;
          aSeed[n] = seed;
          aSize[n] = (1.6 + Math.random() * 2.4) * (1.0 - 0.35 * t);
          aTone[n] = tone;
          n++;
        }
      }

      const treeGeo = new THREE.BufferGeometry();
      treeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      treeGeo.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
      treeGeo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
      treeGeo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
      treeGeo.setAttribute("aTone", new THREE.BufferAttribute(aTone, 1));

      const TREE_VERT = `
        uniform float uTime, uOpen, uSway, uSpark, uIntro, uPixelRatio, uHeightPx;
        uniform float uPhase, uFade, uScale, uPointerStrength;
        uniform vec2 uPointer, uLean;
        attribute float aT, aSeed, aSize, aTone;
        varying float vAlpha, vTone, vSpark;

        const float BASE_Y = ${C.baseY.toFixed(2)};
        const float LEAN = ${C.pointerLean.toFixed(3)};
        const float PUSH = ${C.pointerPush.toFixed(3)};
        const float PRAD = ${C.pointerRadius.toFixed(3)};

        void main() {
          vec3 p = position;
          float tm = uTime + uPhase;

          // Sway grows toward the canopy edge and leaves the base steady.
          float sway  = sin(tm * 0.55 + aSeed * 6.2831 + aT * 2.6);
          float sway2 = cos(tm * 0.37 + aSeed * 4.1);
          float amp   = aT * aT * (0.05 + uSway * 0.30);
          p.x += sway * amp;
          p.z += sway2 * amp * 0.7;

          // The canopy opens outward and lifts as it breathes.
          float open = 1.0 + uOpen * 0.22 * aT;
          p.x *= open;
          p.z *= open;
          p.y += uOpen * 0.30 * aT * aT;

          // A second, faster breath so the drift never settles.
          p.y += sin(tm * 0.4 + aSeed * 3.0) * 0.02 * aT;

          // The whole canopy leans toward the pointer, weighted by aT so the
          // base stays planted and only the free ends of the strands travel.
          p.x += uLean.x * LEAN * aT;
          p.y += uLean.y * LEAN * 0.45 * aT;

          // And strands close to the pointer get shoved aside, so moving across
          // the canopy parts it rather than just tilting the whole thing.
          vec2 dd = p.xy - uPointer;
          float dl = length(dd);
          float infl = uPointerStrength * exp(-(dl * dl) / (PRAD * PRAD));
          p.xy += (dl > 0.0001 ? dd / dl : vec2(0.0)) * infl * PUSH;

          // Open out from the root.
          float grow = smoothstep(0.0, 1.0, clamp((uIntro - aT * 0.55) / 0.45, 0.0, 1.0));
          p.xz *= grow;
          p.y = mix(BASE_Y, p.y, grow);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;

          float spark = uSpark * (0.5 + 0.5 * sin(tm * 7.0 + aSeed * 20.0));
          vSpark = spark;
          vTone  = aTone;
          // Faint per point — the glow comes from density stacking up, and the
          // root still concentrates every strand into a small area.
          vAlpha = (0.09 + 0.52 * smoothstep(0.15, 0.9, aT)) * grow * uFade;

          gl_PointSize = aSize * (1.0 + spark * 0.9) * uPixelRatio
                       * (uHeightPx / 800.0) * (8.5 * uScale / -mv.z);
        }
      `;

      const makeTree = ({ scale = 1, phase = 0, intro = 0 }) => {
        const uniforms = {
          uTime: { value: 0 },
          uOpen: { value: 0 },
          uSway: { value: 0 },
          uSpark: { value: 0 },
          uIntro: { value: reduced ? 1 : intro },
          uPixelRatio: { value: renderer.getPixelRatio() },
          // Keeps the filaments the same visual weight on a phone and on a 27",
          // instead of scaling with the raw pixel count.
          uHeightPx: { value: height() },
          uPhase: { value: phase },
          uFade: { value: 1 },
          uScale: { value: scale },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uLean: { value: new THREE.Vector2(0, 0) },
          uPointerStrength: { value: 0 },
          ...palette(),
        };
        const material = new THREE.ShaderMaterial({
          uniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: TREE_VERT,
          fragmentShader: FRAG,
        });
        const pts = new THREE.Points(treeGeo, material);
        pts.scale.setScalar(scale);
        scene.add(pts);
        return { pts, material, uniforms };
      };

      const centre = makeTree({ scale: C.treeScale, phase: 0 });

      /* ── burst geometry: rays of debris thrown from a point ─────────────── */

      const BP = C.burstPoints;
      const bDir = new Float32Array(BP * 3);
      const bSpeed = new Float32Array(BP);
      const bDelay = new Float32Array(BP);
      const bSize = new Float32Array(BP);
      const bTone = new Float32Array(BP);
      const bSeed = new Float32Array(BP);

      // A handful of ray directions give the burst its spikes; everything else
      // is scattered, so it reads as a star rather than an even puffball.
      const rays = [];
      for (let r = 0; r < C.burstRays; r++) {
        const a = (r / C.burstRays) * TAU + (Math.random() - 0.5) * 0.35;
        const el = (Math.random() - 0.5) * 1.0;
        rays.push([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)]);
      }

      const [reachLo, reachHi] = C.burstReach;
      for (let i = 0; i < BP; i++) {
        const onRay = Math.random() < 0.55;
        let x, y, z;
        if (onRay) {
          const r = rays[i % C.burstRays];
          x = r[0] + (Math.random() - 0.5) * 0.16;
          y = r[1] + (Math.random() - 0.5) * 0.16;
          z = r[2] + (Math.random() - 0.5) * 0.16;
        } else {
          const a = Math.random() * TAU;
          const el = Math.asin(2 * Math.random() - 1);
          x = Math.cos(a) * Math.cos(el);
          y = Math.sin(el);
          z = Math.sin(a) * Math.cos(el);
        }
        const len = Math.hypot(x, y, z) || 1;
        bDir[i * 3 + 0] = x / len;
        bDir[i * 3 + 1] = y / len;
        bDir[i * 3 + 2] = (z / len) * Z_SQUASH; // squash after normalising

        // Ray points reach much further, which is what makes the spikes.
        bSpeed[i] =
          reachLo + Math.pow(Math.random(), onRay ? 0.5 : 1.9) * (reachHi - reachLo);
        bDelay[i] = Math.random() * 0.12;
        bSize[i] = 1.4 + Math.random() * 2.6;
        bTone[i] = Math.random() < 0.25 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.2;
        bSeed[i] = Math.random();
      }

      const burstGeo = new THREE.BufferGeometry();
      // Every point starts at the origin; aDir/aSpeed carry it outward.
      burstGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BP * 3), 3));
      burstGeo.setAttribute("aDir", new THREE.BufferAttribute(bDir, 3));
      burstGeo.setAttribute("aSpeed", new THREE.BufferAttribute(bSpeed, 1));
      burstGeo.setAttribute("aDelay", new THREE.BufferAttribute(bDelay, 1));
      burstGeo.setAttribute("aSize", new THREE.BufferAttribute(bSize, 1));
      burstGeo.setAttribute("aTone", new THREE.BufferAttribute(bTone, 1));
      burstGeo.setAttribute("aSeed", new THREE.BufferAttribute(bSeed, 1));

      const BURST_VERT = `
        uniform float uTime, uAge, uSpark, uPixelRatio, uHeightPx, uScale;
        attribute vec3 aDir;
        attribute float aSpeed, aDelay, aSize, aTone, aSeed;
        varying float vAlpha, vTone, vSpark;

        void main() {
          float a = clamp((uAge - aDelay) / max(0.001, 1.0 - aDelay), 0.0, 1.0);
          float ease = 1.0 - pow(1.0 - a, 2.0); // thrown out, decelerating gently

          vec3 p = aDir * (aSpeed * ease);
          p.y -= 0.30 * a * a; // drifts down as it spreads

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;

          float spark = uSpark * (0.5 + 0.5 * sin(uTime * 9.0 + aSeed * 20.0));
          vSpark = spark;
          vTone  = aTone;
          // Every point sits on the origin at a=0, so the stack of them makes
          // the initial flash for free; it thins out as they spread.
          vAlpha = pow(1.0 - a, 1.6) * 0.85;

          gl_PointSize = aSize * (1.0 + spark * 0.8) * uPixelRatio
                       * (uHeightPx / 800.0) * (8.5 * uScale / -mv.z)
                       * (1.0 - 0.35 * a);
        }
      `;

      const bursts = [];
      const raycaster = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hitPt = new THREE.Vector3();
      const ndc = new THREE.Vector2();

      const retire = (b) => {
        scene.remove(b.pts);
        b.material.dispose(); // geometry is shared — never disposed here
      };

      const burstAt = (clientX, clientY, now) => {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        ndc.set(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        if (!raycaster.ray.intersectPlane(plane, hitPt)) return;

        const [lo, hi] = C.burstScale;
        const scale = lo + Math.random() * (hi - lo);
        const uniforms = {
          uTime: { value: 0 },
          uAge: { value: 0 },
          uSpark: { value: 0 },
          uPixelRatio: { value: renderer.getPixelRatio() },
          uHeightPx: { value: height() },
          uScale: { value: scale },
          ...palette(),
        };
        const material = new THREE.ShaderMaterial({
          uniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: BURST_VERT,
          fragmentShader: FRAG,
        });
        const pts = new THREE.Points(burstGeo, material);
        pts.position.copy(hitPt);
        pts.scale.setScalar(scale);
        pts.rotation.z = Math.random() * TAU;
        scene.add(pts);

        bursts.push({ pts, material, uniforms, born: now });
        while (bursts.length > C.burstMax) retire(bursts.shift());
      };

      /* ── pointer ────────────────────────────────────────────────────────── */

      // Current (smoothed) and target pointer state. lx/ly are in the centre
      // tree's own space; nx/ny are the -1..1 screen offset used for the lean;
      // s fades the whole influence in and out as the pointer comes and goes.
      const ptr = { lx: 0, ly: 0, nx: 0, ny: 0, s: 0 };
      const ptrT = { lx: 0, ly: 0, nx: 0, ny: 0, s: 0 };

      const trackPointer = (clientX, clientY) => {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const fx = (clientX - rect.left) / rect.width;
        const fy = (clientY - rect.top) / rect.height;
        ptrT.nx = fx * 2 - 1;
        ptrT.ny = -(fy * 2 - 1);

        ndc.set(ptrT.nx, ptrT.ny);
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(plane, hitPt)) {
          // The shader runs in the tree's own space, and the tree is scaled.
          ptrT.lx = hitPt.x / C.treeScale;
          ptrT.ly = hitPt.y / C.treeScale;
        }
        ptrT.s = 1;
      };

      const releasePointer = () => { ptrT.s = 0; ptrT.nx = 0; ptrT.ny = 0; };

      /* ── motion ─────────────────────────────────────────────────────────── */

      // The canopy moves on its own, independent of anything playing. Each
      // channel layers two sines on incommensurable periods, so the drift takes
      // a long time to visibly repeat rather than pulsing on an obvious cycle.
      const motion = (t) => ({
        open: 0.32 + 0.20 * Math.sin(t * 0.21) + 0.09 * Math.sin(t * 0.37 + 1.7),
        sway: 0.30 + 0.18 * Math.sin(t * 0.17 + 0.6) + 0.08 * Math.sin(t * 0.43),
        spark: 0.16 + 0.09 * Math.sin(t * 0.29 + 2.1),
      });

      /* ── loop ───────────────────────────────────────────────────────────── */

      const clock = new THREE.Clock();
      let prevT = 0;
      let running = true;

      const frame = () => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        if (!running) return;

        const t = clock.getElapsedTime();
        const dt = Math.min(t - prevT, 0.1);
        prevT = t;
        const m = motion(t);

        // Frame-rate independent follow, so the canopy trails the pointer at
        // the same speed whether the tab is running at 120fps or struggling.
        const ease = 1 - Math.exp(-C.pointerEase * dt);
        ptr.lx += (ptrT.lx - ptr.lx) * ease;
        ptr.ly += (ptrT.ly - ptr.ly) * ease;
        ptr.nx += (ptrT.nx - ptr.nx) * ease;
        ptr.ny += (ptrT.ny - ptr.ny) * ease;
        ptr.s += (ptrT.s - ptr.s) * ease;

        const cu = centre.uniforms;
        cu.uTime.value = t;
        cu.uOpen.value = m.open;
        cu.uSway.value = m.sway;
        cu.uSpark.value = m.spark;
        cu.uPointer.value.set(ptr.lx, ptr.ly);
        cu.uLean.value.set(ptr.nx * ptr.s, ptr.ny * ptr.s);
        cu.uPointerStrength.value = ptr.s;
        // Driven by real elapsed time, not by accumulated frame deltas: a
        // throttled or backgrounded tab delivers a handful of frames per
        // second, and summing clamped deltas would stretch a 2.4s intro into
        // the better part of a minute.
        if (!reduced) cu.uIntro.value = Math.min(1, t / C.intro);
        centre.pts.rotation.y = Math.sin(t * 0.08) * 0.12;

        for (let i = bursts.length - 1; i >= 0; i--) {
          const b = bursts[i];
          const age = (t - b.born) / C.burstLife;
          b.uniforms.uTime.value = t;
          b.uniforms.uSpark.value = m.spark;
          b.uniforms.uAge.value = age;
          if (age >= 1) {
            retire(b);
            bursts.splice(i, 1);
          }
        }

        renderer.render(scene, camera);
      };

      if (reduced) {
        renderer.render(scene, camera); // one static frame, no animation
      } else {
        raf = requestAnimationFrame(frame);
      }

      // Anywhere on the hero sets off a burst — including over the title and
      // the copy — except the mixer and any real control, which keep their
      // clicks. The canvas itself stays pointer-events: none.
      const IGNORE = ".mixer, button, a, input, select, textarea, [role='button']";
      const heroEl = host.closest(".hero") || host.parentElement;
      const onPointerDown = (e) => {
        if (e.target.closest && e.target.closest(IGNORE)) return;
        burstAt(e.clientX, e.clientY, clock.getElapsedTime());
      };
      // Movement steers the canopy. Passive and never preventDefault'd, so a
      // touch drag still scrolls the page normally.
      const onPointerMove = (e) => trackPointer(e.clientX, e.clientY);
      const onPointerGone = () => releasePointer();
      // Touch has no hover, so let go when the finger lifts.
      const onPointerUp = (e) => { if (e.pointerType !== "mouse") releasePointer(); };

      if (heroEl && !reduced) {
        heroEl.addEventListener("pointerdown", onPointerDown);
        heroEl.addEventListener("pointermove", onPointerMove, { passive: true });
        heroEl.addEventListener("pointerleave", onPointerGone);
        heroEl.addEventListener("pointercancel", onPointerGone);
        heroEl.addEventListener("pointerup", onPointerUp);
        cleanupFns.push(() => {
          heroEl.removeEventListener("pointerdown", onPointerDown);
          heroEl.removeEventListener("pointermove", onPointerMove);
          heroEl.removeEventListener("pointerleave", onPointerGone);
          heroEl.removeEventListener("pointercancel", onPointerGone);
          heroEl.removeEventListener("pointerup", onPointerUp);
        });
      }

      /* ── lifecycle: don't burn GPU when nobody is looking ───────────────── */

      const onVisibility = () => { running = !document.hidden; };
      document.addEventListener("visibilitychange", onVisibility);
      cleanupFns.push(() => document.removeEventListener("visibilitychange", onVisibility));

      let io = null;
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(
          ([e]) => { running = e.isIntersecting && !document.hidden; },
          { threshold: 0 }
        );
        io.observe(host);
        cleanupFns.push(() => io.disconnect());
      }

      const onResize = () => {
        const w = width(), h = height();
        if (!w || !h) return;
        camera.aspect = w / h;
        frameCamera();
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h);
        const pr = renderer.getPixelRatio();
        centre.uniforms.uPixelRatio.value = pr;
        centre.uniforms.uHeightPx.value = h;
        bursts.forEach((b) => {
          b.uniforms.uPixelRatio.value = pr;
          b.uniforms.uHeightPx.value = h;
        });
        if (reduced) renderer.render(scene, camera);
      };
      window.addEventListener("resize", onResize);
      cleanupFns.push(() => window.removeEventListener("resize", onResize));

      cleanupFns.push(() => {
        bursts.forEach(retire);
        bursts.length = 0;
        centre.material.dispose();
        treeGeo.dispose();
        burstGeo.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      });
    });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      cleanupFns.forEach((fn) => { try { fn(); } catch (e) {} });
      cleanupFns = [];
    };
  }, []);

  return <div className="hero-particles" ref={hostRef} aria-hidden="true" />;
}

// Same easing the shader uses, so CPU-side geometry and GPU-side growth agree.
function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

window.HeroParticles = HeroParticles;
