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

  // Linear crossfade gains
  const gainA = crossfade <= 0 ? 1 : 1 - crossfade;
  const gainB = crossfade >= 0 ? 1 : 1 + crossfade;

  React.useEffect(() => {
    if (audioARef.current) audioARef.current.volume = gainA;
  }, [gainA]);

  React.useEffect(() => {
    if (audioBRef.current) audioBRef.current.volume = gainB;
  }, [gainB]);

  // Auto-play Blop on deck A when the page loads. Browsers will allow this
  // after any user gesture; otherwise we retry on first interaction.
  React.useEffect(() => {
    const tryPlay = () => {
      const a = audioARef.current;
      if (!a) return;
      a.currentTime = 0;
      a.play().then(() => setPlayingA(true)).catch(() => {});
    };
    tryPlay();
    const onFirstClick = () => {
      tryPlay();
      window.removeEventListener("pointerdown", onFirstClick);
    };
    window.addEventListener("pointerdown", onFirstClick, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstClick);
  }, []);

  return (
    <div className="mixer" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioARef} src={trackA || undefined} loop preload="none" />
      <audio ref={audioBRef} src={trackB || undefined} loop preload="none" />

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
        />
      </div>
    </div>
  );
}

window.Mixer = Mixer;
