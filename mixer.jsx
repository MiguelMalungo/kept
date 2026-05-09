// Two-deck mixer with crossfader. Glass morphism styling.

const TRACKS = [
  { name: "Blop",          src: "assets/Blop.mp3" },
  { name: "Echoes Extend", src: "assets/EchoesExtend.mp3" },
  { name: "Fields",        src: "assets/Fields.mp3" },
  { name: "Horizon",       src: "assets/Horizon1.mp3" },
  { name: "Melancholic",   src: "assets/Melanchoholic.mp3" },
  { name: "Release",       src: "assets/Release.mp3" },
  { name: "Uno 1",         src: "assets/Uno1.mp3" },
  { name: "Uno 2",         src: "assets/Uno2.mp3" },
  { name: "A and A",       src: "assets/aanda.mp3" },
  { name: "Of the Sun",    src: "assets/oftheSun.mp3" },
];

function Deck({ label, audioRef, track, setTrack, playing, setPlaying }) {
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [track]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      // Resume any suspended AudioContext on this user gesture before play.
      const ctx = window.__mixerAudioCtx;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      a.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const restart = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    setCurrentTime(0);
  };

  const onSeek = (e) => {
    const a = audioRef.current;
    if (!a) return;
    const t = parseFloat(e.target.value);
    a.currentTime = t;
    setCurrentTime(t);
  };

  const fmt = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="deck">
      <div className="deck-label">Deck {label}</div>
      <select
        className="deck-select"
        value={track}
        onChange={(e) => {
          setTrack(e.target.value);
          setPlaying(false);
          setCurrentTime(0);
          setDuration(0);
        }}
      >
        <option value="">— Select track —</option>
        {TRACKS.map((t) => (
          <option key={t.src} value={t.src}>{t.name}</option>
        ))}
      </select>

      <div className="deck-transport">
        <button className="deck-cue" onClick={restart} disabled={!track} title="Restart">
          <svg viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="1.5" height="8"/><polygon points="11,2 4.5,6 11,10"/></svg>
        </button>
        <button className={`deck-play ${playing ? "is-playing" : ""}`} onClick={togglePlay} disabled={!track}>
          {playing ? (
            <svg viewBox="0 0 12 12" fill="currentColor"><rect x="3" y="2" width="2" height="8"/><rect x="7" y="2" width="2" height="8"/></svg>
          ) : (
            <svg viewBox="0 0 12 12" fill="currentColor"><polygon points="3,2 10,6 3,10"/></svg>
          )}
        </button>
      </div>

      <div className="deck-seek">
        <input
          className="deck-seek-slider"
          type="range" min="0" max={duration || 0} step="0.1"
          value={currentTime}
          onChange={onSeek}
          onInput={onSeek}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={!track || !duration}
        />
        <div className="deck-time">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

    </div>
  );
}

function Mixer() {
  const [trackA, setTrackA] = React.useState("assets/Blop.mp3");
  const [trackB, setTrackB] = React.useState("");
  const [playingA, setPlayingA] = React.useState(false);
  const [playingB, setPlayingB] = React.useState(false);
  const [crossfade, setCrossfade] = React.useState(0); // -1..1, 0=both equal

  const audioARef = React.useRef(null);
  const audioBRef = React.useRef(null);
  const audioCtxRef = React.useRef(null);
  const gainARef = React.useRef(null);
  const gainBRef = React.useRef(null);
  const graphBuiltRef = React.useRef(false);

  // Linear crossfade gains
  const gainA = crossfade <= 0 ? 1 : 1 - crossfade;
  const gainB = crossfade >= 0 ? 1 : 1 + crossfade;

  // Build Web Audio graph on ALL platforms. HTMLAudioElement.volume is
  // ignored on iOS Safari, so going through GainNodes is the only way to get
  // reliable crossfade control everywhere. On other browsers it works just
  // as well — we route every audio element through a gain node so behavior
  // is identical across desktop Chrome/Safari/Firefox and mobile iOS/Android.
  const ensureAudioGraph = React.useCallback(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    // Create AudioContext lazily — once. Suspended state on iOS until a
    // user gesture resumes it; we call resume() on every interaction below.
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new Ctx();
        // Expose so Deck togglePlay can resume after iOS suspends it.
        window.__mixerAudioCtx = audioCtxRef.current;
      } catch (e) {
        return;
      }
    }
    const ctx = audioCtxRef.current;

    // Wire each <audio> into the graph exactly once. createMediaElementSource
    // can only be called once per element — guard with a ref so React
    // re-renders never re-wire and throw InvalidStateError.
    if (!graphBuiltRef.current) {
      try {
        const srcA = ctx.createMediaElementSource(a);
        const srcB = ctx.createMediaElementSource(b);
        const gA = ctx.createGain();
        const gB = ctx.createGain();
        gA.gain.value = gainA;
        gB.gain.value = gainB;
        srcA.connect(gA).connect(ctx.destination);
        srcB.connect(gB).connect(ctx.destination);
        gainARef.current = gA;
        gainBRef.current = gB;
        graphBuiltRef.current = true;
      } catch (e) {
        // Already wired in this session — leave existing graph alone.
      }
    }

    // Resume on every call. iOS suspends on backgrounding / lock screen and
    // any browser may suspend after long inactivity; resuming is cheap.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }, []);

  // Push gain changes through the GainNodes once they exist. Before the
  // first user gesture (pre-graph) we fall back to the audio element's
  // .volume — harmless on iOS (ignored) and works on everything else.
  React.useEffect(() => {
    if (gainARef.current) gainARef.current.gain.value = gainA;
    else if (audioARef.current) audioARef.current.volume = gainA;
  }, [gainA]);

  React.useEffect(() => {
    if (gainBRef.current) gainBRef.current.gain.value = gainB;
    else if (audioBRef.current) audioBRef.current.volume = gainB;
  }, [gainB]);

  // Bootstrap the audio graph on the first user gesture *anywhere*. iOS will
  // not let us create / resume an AudioContext outside a gesture, so we listen
  // capture-phase across the whole document and tear down once it's set up.
  React.useEffect(() => {
    const onGesture = () => {
      ensureAudioGraph();
      // Don't auto-play deck A here — iOS treats audio.play() outside the
      // exact gesture call stack as a new attempt that may be blocked. We
      // let the user tap Play to start audio. The graph being ready means
      // the very first play call already routes through the gain node.
    };
    document.addEventListener("pointerdown", onGesture, { capture: true });
    document.addEventListener("touchstart", onGesture, { capture: true, passive: true });
    document.addEventListener("click", onGesture, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onGesture, { capture: true });
      document.removeEventListener("touchstart", onGesture, { capture: true });
      document.removeEventListener("click", onGesture, { capture: true });
    };
  }, [ensureAudioGraph]);

  // Try to autoplay Deck A on mount. Most desktop browsers and Android Chrome
  // allow muted-or-not autoplay for a first audio element on page load; iOS
  // and Safari will silently reject and the user taps Play instead.
  React.useEffect(() => {
    const a = audioARef.current;
    if (!a) return;
    a.play().then(() => setPlayingA(true)).catch(() => {});
  }, []);

  return (
    <div className="mixer" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioARef} src={trackA || undefined} loop preload="metadata" />
      <audio ref={audioBRef} src={trackB || undefined} loop preload="metadata" />

      <div className="mixer-decks">
        <Deck
          label="A"
          audioRef={audioARef}
          track={trackA} setTrack={setTrackA}
          playing={playingA} setPlaying={setPlayingA}
        />
        <Deck
          label="B"
          audioRef={audioBRef}
          track={trackB} setTrack={setTrackB}
          playing={playingB} setPlaying={setPlayingB}
        />
      </div>

      <div className="mixer-crossfade">
        <div className="crossfade-labels">
          <span>A</span>
          <span>CROSSFADE</span>
          <span>B</span>
        </div>
        <input
          className="crossfade-slider"
          type="range" min="-1" max="1" step="0.01"
          value={crossfade}
          onChange={(e) => setCrossfade(parseFloat(e.target.value))}
          onInput={(e) => setCrossfade(parseFloat(e.target.value))}
          onTouchStart={(e) => { e.stopPropagation(); ensureAudioGraph(); }}
          onTouchMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => { e.stopPropagation(); ensureAudioGraph(); }}
          onMouseDown={() => ensureAudioGraph()}
        />
      </div>
    </div>
  );
}

window.Mixer = Mixer;
