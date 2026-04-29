// Ambient video placeholder — animated canvas "video" with flowing color clouds.
// Real ambient video files would slot in here, but as placeholder, we render
// soft moving gradients to evoke the feel of looping cinematic footage.

const { useEffect, useRef } = React;

function AmbientCanvas({ hue = 28, tone = 0.08, speed = 1, seed = 0, full = false }) {
  const ref = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      h = canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Base colors derived from hue/tone
    const baseL = 0.18;
    const accentL = 0.55;
    const palette = [
      `oklch(${baseL} ${tone * 0.6} ${hue})`,
      `oklch(${baseL + 0.10} ${tone} ${(hue + 20) % 360})`,
      `oklch(${accentL} ${tone * 1.2} ${(hue - 20 + 360) % 360})`,
      `oklch(${baseL + 0.04} ${tone * 0.8} ${(hue + 60) % 360})`,
    ];

    // Blob sources
    const blobs = Array.from({ length: 5 }, (_, i) => ({
      x: 0.2 + 0.6 * ((i + seed) % 5) / 4,
      y: 0.3 + 0.4 * ((i * 3 + seed) % 5) / 4,
      r: 0.4 + 0.3 * (i % 3) / 2,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      speedX: 0.0003 + Math.random() * 0.0004,
      speedY: 0.0003 + Math.random() * 0.0004,
      color: palette[i % palette.length],
    }));

    const draw = (t) => {
      // base fill
      ctx.fillStyle = `oklch(${baseL - 0.03} ${tone * 0.4} ${hue})`;
      ctx.fillRect(0, 0, w, h);

      blobs.forEach((b) => {
        const cx = (b.x + Math.sin(t * b.speedX * speed + b.phaseX) * 0.18) * w;
        const cy = (b.y + Math.cos(t * b.speedY * speed + b.phaseY) * 0.18) * h;
        const r = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, b.color);
        g.addColorStop(1, "oklch(0 0 0 / 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [hue, tone, speed, seed]);

  return <canvas ref={ref} className={full ? "hero-video-canvas" : "poem-canvas"} />;
}

window.AmbientCanvas = AmbientCanvas;
