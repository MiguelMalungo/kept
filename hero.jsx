// Hero with looping ambient video bg + scroll-driven typography reveal

const { useEffect, useState, useRef } = React;

const HERO_VIDEOS = ["assets/web/hero.mp4", "assets/web/hero2.mp4"];
const FADE_DURATION = 3; // crossfade length in seconds
const TRIGGER_BUFFER = 0.5; // start fade slightly earlier so the loop wrap stays hidden

function HeroVideos() {
  const [active, setActive] = useState(0);
  const refs = [useRef(null), useRef(null)];
  const swapLockRef = useRef(false);

  // Pre-warm both decoders once: play, then pause non-active back to 0.
  // After this, calling play() resumes instantly with no buffer lag.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      refs.map(async (r) => {
        const v = r.current;
        if (!v) return;
        try { await v.play(); } catch {}
      })
    ).then(() => {
      if (cancelled) return;
      refs.forEach((r, i) => {
        const v = r.current;
        if (!v) return;
        if (i !== 0) {
          v.pause();
          v.currentTime = 0;
        }
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Watch active video; near its end, start next from 0 + crossfade.
  useEffect(() => {
    const vid = refs[active].current;
    if (!vid) return;

    const onTime = () => {
      if (!vid.duration || swapLockRef.current) return;
      if (vid.duration - vid.currentTime <= FADE_DURATION + TRIGGER_BUFFER) {
        swapLockRef.current = true;

        const nextIdx = (active + 1) % HERO_VIDEOS.length;
        const nextVid = refs[nextIdx].current;
        if (nextVid) {
          nextVid.currentTime = 0;
          nextVid.play().catch(() => {});
        }

        // Wait one frame so playback actually started before swapping opacity
        requestAnimationFrame(() => setActive(nextIdx));

        // After fade completes, pause the now-hidden previous video at frame 0
        setTimeout(() => {
          if (vid) { vid.pause(); vid.currentTime = 0; }
          swapLockRef.current = false;
        }, (FADE_DURATION + 0.3) * 1000);
      }
    };

    vid.addEventListener("timeupdate", onTime);
    return () => vid.removeEventListener("timeupdate", onTime);
  }, [active]);

  return (
    <div className="hero-video">
      {HERO_VIDEOS.map((src, i) => (
        <video
          key={src}
          ref={refs[i]}
          className="hero-video-canvas"
          src={src}
          autoPlay={i === 0}
          loop
          muted
          playsInline
          preload="auto"
          style={{
            opacity: i === active ? 1 : 0,
            transition: `opacity ${FADE_DURATION}s linear`,
          }}
        />
      ))}
    </div>
  );
}

function Hero() {
  const titleRef = useRef(null);
  const [scrollT, setScrollT] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const t = Math.min(1, Math.max(0, y / window.innerHeight));
      setScrollT(t);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const title = "Serenity";

  const renderChars = (text) =>
    text.split("").map((c, i) => {
      const delay = i * 0.05;
      const localT = Math.min(1, Math.max(0, scrollT - delay));
      return (
        <span
          key={i}
          className="char"
          style={{
            transform: `translateY(${localT * 60}px)`,
            opacity: 1 - localT * 0.7,
          }}
        >
          {c === " " ? "\u00A0" : c}
        </span>
      );
    });

  return (
    <section className="hero" id="hero">
      <HeroVideos />

      <div className="hero-content">
        <div>
          <h1 className="hero-title" ref={titleRef}>
            <span style={{ display: "inline-block" }}>{renderChars(title)}</span>
            <em>by Kaleidokonscious</em>
          </h1>
        </div>
        <div className="hero-meta">
          <span>Poems &nbsp;·&nbsp; Films &nbsp;·&nbsp; Prints &nbsp;·&nbsp; Music</span>
          <span>Unfolding words by Kaleidokonscious</span>
          <span>Images & Videos generated w/ Midjourney</span>
          <span>Songs generated w/ Suno</span>
        </div>
        <window.Mixer />
      </div>

      <div className="hero-scroll">Scroll &nbsp; ↓</div>
    </section>
  );
}

window.Hero = Hero;
