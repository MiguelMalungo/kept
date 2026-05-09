// Main app — composes Hero, Gallery, Modal, Tweaks panel for color theme.

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "cream",
  "accentHue": 42,
  "grain": 0.06
}/*EDITMODE-END*/;

const THEMES = {
  cream: {
    paper: "oklch(0.97 0.012 80)",
    paperDeep: "oklch(0.93 0.018 75)",
    ink: "oklch(0.18 0.012 60)",
    inkSoft: "oklch(0.32 0.012 60)",
    inkFaint: "oklch(0.55 0.010 60)",
    rule: "oklch(0.85 0.012 70)",
  },
  ink: {
    paper: "oklch(0.16 0.010 60)",
    paperDeep: "oklch(0.12 0.010 60)",
    ink: "oklch(0.94 0.012 80)",
    inkSoft: "oklch(0.78 0.010 70)",
    inkFaint: "oklch(0.55 0.008 70)",
    rule: "oklch(0.28 0.010 60)",
  },
  bone: {
    paper: "oklch(0.95 0.006 90)",
    paperDeep: "oklch(0.90 0.008 90)",
    ink: "oklch(0.22 0.008 250)",
    inkSoft: "oklch(0.40 0.010 250)",
    inkFaint: "oklch(0.60 0.010 250)",
    rule: "oklch(0.84 0.008 90)",
  },
  moss: {
    paper: "oklch(0.96 0.012 110)",
    paperDeep: "oklch(0.91 0.018 110)",
    ink: "oklch(0.22 0.030 145)",
    inkSoft: "oklch(0.38 0.030 145)",
    inkFaint: "oklch(0.58 0.020 130)",
    rule: "oklch(0.84 0.012 120)",
  },
};

function applyTheme(theme, accentHue, grain) {
  const t = THEMES[theme] || THEMES.cream;
  const root = document.documentElement;
  root.style.setProperty("--paper", t.paper);
  root.style.setProperty("--paper-deep", t.paperDeep);
  root.style.setProperty("--ink", t.ink);
  root.style.setProperty("--ink-soft", t.inkSoft);
  root.style.setProperty("--ink-faint", t.inkFaint);
  root.style.setProperty("--rule", t.rule);
  root.style.setProperty("--accent", `oklch(0.62 0.13 ${accentHue})`);
  root.style.setProperty("--accent-deep", `oklch(0.52 0.14 ${accentHue - 2})`);
  // grain
  const before = document.querySelector("style[data-grain]");
  const css = `body::before { opacity: ${grain} !important; }`;
  if (before) before.textContent = css;
  else {
    const s = document.createElement("style");
    s.setAttribute("data-grain", "1");
    s.textContent = css;
    document.head.appendChild(s);
  }
}

function App() {
  const [openPoem, setOpenPoem] = useState(null);
  const [navLight, setNavLight] = useState(false);
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Apply theme
  useEffect(() => {
    applyTheme(tweaks.theme, tweaks.accentHue, tweaks.grain);
  }, [tweaks.theme, tweaks.accentHue, tweaks.grain]);

  // Nav color shift after hero
  useEffect(() => {
    const onScroll = () => setNavLight(window.scrollY > window.innerHeight * 0.85);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = openPoem ? "hidden" : "";
  }, [openPoem]);

  return (
    <>
      <nav className={`nav ${navLight ? "is-light" : ""}`} data-screen-label="Nav">
        <a href="#hero" className="nav-mark">
          <img className="nav-logo" src="assets/kk.png" alt="KK" />
        </a>
      </nav>

      <main data-screen-label="01 Landing">
        <Hero />
        <Gallery onOpen={setOpenPoem} />

        <footer className="footer">
          <div>
            <div className="footer-mark">Blend</div>
            <div style={{ marginTop: 8, fontSize: 10 }}>A digital garden, always growing</div>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <span>© MMXXVI</span>
            <span>Press</span>
            <span>Contact</span>
            <span>Newsletter</span>
          </div>
        </footer>
      </main>

      <PrintModal poem={openPoem} open={!!openPoem} onClose={() => setOpenPoem(null)} />

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label="Theme">
          <window.TweakSelect
            label="Color"
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[
              { value: "cream", label: "Cream paper" },
              { value: "ink",   label: "Ink (dark)" },
              { value: "bone",  label: "Bone & slate" },
              { value: "moss",  label: "Moss" },
            ]}
          />
          <window.TweakSlider
            label="Accent hue"
            value={tweaks.accentHue}
            onChange={(v) => setTweak("accentHue", v)}
            min={0} max={360} step={1}
          />
          <window.TweakSlider
            label="Grain"
            value={tweaks.grain}
            onChange={(v) => setTweak("grain", v)}
            min={0} max={0.18} step={0.005}
          />
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
