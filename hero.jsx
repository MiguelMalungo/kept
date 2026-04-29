// Hero with looping ambient video bg + scroll-driven typography reveal

const { useEffect, useState, useRef } = React;

function Hero() {
  const titleRef = useRef(null);
  const [scrollT, setScrollT] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // 0 -> 1 over first viewport height
      const t = Math.min(1, Math.max(0, y / window.innerHeight));
      setScrollT(t);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Letter-by-letter spread on scroll
  const title = "Kept";
  const subtitle = "an interactive book of poems";

  // Each letter shifts down + fades as user scrolls
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
      <div className="hero-video">
        <video
          className="hero-video-canvas"
          src="assets/web/hero.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>

      <div className="hero-content">
        <div>
          <h1 className="hero-title" ref={titleRef}>
            <span style={{ display: "inline-block" }}>{renderChars(title)}</span>
            <em>by Kaleidokonscious</em>
          </h1>
          <div
            className="hero-fragment"
            style={{
              transform: `translateY(${scrollT * 30}px)`,
              opacity: 1 - scrollT * 1.4,
            }}
          >
            "we kept burning <br />
            as the curtains stayed closed"
          </div>
        </div>
        <div className="hero-meta">
          <span>Poems &nbsp;·&nbsp; Films &nbsp;·&nbsp; Prints</span>
          <b>6teen short works</b>
          <span>by Kaleidokonscious</span>
        </div>
      </div>

      <div className="hero-scroll">Scroll &nbsp; ↓</div>
    </section>
  );
}

window.Hero = Hero;
