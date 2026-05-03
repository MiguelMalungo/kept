// Poem gallery — 16 cards in editorial mixed-size grid.
// On hover: ambient "video" plays + fragment reveals.
// Click: opens print modal.

const { useState } = React;

// Editorial size pattern across 16 cards (12-col grid)
// Each row sums to 12. Mix of lg(6)/md(4)/sm(3) for rhythm.
const SIZE_PATTERN = [
  "lg", "md",  "sm",       // row 1: 6 + 4 + ? -> use lg+md+sm sums to 13, fix below
];

// Build a deterministic editorial pattern that tiles 12-col rows nicely
function buildSizes(n) {
  // Rows: [lg, md, sm, sm], [md, md, lg], [sm, sm, sm, sm], etc.
  const rows = [
    ["lg", "sm", "sm"],            // 6 + 3 + 3 = 12
    ["md", "md", "md"],            // 4 + 4 + 4 = 12
    ["sm", "lg", "sm"],            // 3 + 6 + 3 = 12
    ["md", "sm", "sm", "md"],      // 4 + 3 + 3 + 4 = nope: 14
  ];
  // Use safe rows only
  const safe = [
    ["lg", "sm", "sm"],            // 12
    ["md", "md", "md"],            // 12
    ["sm", "lg", "sm"],            // 12
    ["md", "lg", "md"],            // err 14 -- skip
  ];
  const valid = [
    ["lg", "sm", "sm"],
    ["md", "md", "md"],
    ["sm", "lg", "sm"],
    ["sm", "sm", "md", "md"],      // 3+3+4+? nope 14
  ];
  // simpler: cycle these rows that sum to 12:
  const rowsOk = [
    ["lg", "sm", "sm"],   // 6+3+3
    ["md", "md", "md"],   // 4+4+4
    ["sm", "lg", "sm"],   // 3+6+3
    ["md", "md", "md"],   // 4+4+4
  ];
  const out = [];
  let r = 0;
  while (out.length < n) {
    const row = rowsOk[r % rowsOk.length];
    for (const s of row) {
      if (out.length < n) out.push(s);
    }
    r++;
  }
  return out;
}

function PoemCard({ poem, index, size, onOpen }) {
  const [hover, setHover] = useState(false);

  return (
    <article
      className={`poem-card size-${size}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(poem)}
    >
      <div className="poem-media">
        {poem.video ? (
          <video
            className="poem-canvas"
            src={poem.video}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <AmbientCanvas
            hue={poem.hue}
            tone={poem.tone}
            speed={hover ? 1.6 : 0.5}
            seed={index}
          />
        )}
        <div className="poem-media-overlay">
          <div className="poem-media-top">
            <span className="poem-num">{poem.num}</span>
          </div>
          <div className="poem-fragment-overlay">
            {(poem.body || "").split("\n").filter(l => l.trim()).slice(0, 2).map((line, i) => (
              <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
            ))}
          </div>
          <div className="poem-mobile-cta">Read &amp; View Print</div>
        </div>
      </div>
      <div className="poem-meta">
        <h3 className="poem-title">{poem.title}</h3>
        <button className="poem-print-btn" onClick={(e) => { e.stopPropagation(); onOpen(poem); }}>
          <span className="btn-label-desktop">View print</span>
          <span className="btn-label-mobile">Read &amp; View Print</span>
        </button>
      </div>
    </article>
  );
}

function Gallery({ onOpen }) {
  const sorted = [
    ...window.POEMS.filter(p => p.body && p.body.trim()),
    ...window.POEMS.filter(p => !p.body || !p.body.trim()),
  ];
  const sizes = buildSizes(sorted.length);
  return (
    <>
      <section className="intro" id="gallery">
        <div>
          <div className="intro-label">The collection</div>
          <h2>6teen poems,<br/><em>6teen short films,</em><br/>6teen prints.</h2>
        </div>
        <p>
          Open a poem to read it whole,
          and download the print as PNG or PDF — sized for screen or for paper.
        </p>
      </section>
      <section className="gallery">
        <div className="gallery-grid">
          {sorted.map((p, i) => (
            <PoemCard key={p.num} poem={p} index={i} size={sizes[i]} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </>
  );
}

window.Gallery = Gallery;
