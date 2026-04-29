// Print modal — preview of digital print + PNG/PDF download buttons.
// Renders the print to canvas for download.

const { useEffect, useRef } = React;

function PrintModal({ poem, open, onClose }) {
  const printRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!poem) return null;

  const lines = (poem.body || "").split("\n").filter(l => l.trim() !== "");

  // Render the print as a canvas image for download
  const renderPrintCanvas = (scale = 2) => {
    const W = 900, H = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // Paper bg
    ctx.fillStyle = "#f6f1e7";
    ctx.fillRect(0, 0, W, H);

    // Subtle texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.025)";
    ctx.lineWidth = 1;
    for (let i = 0; i < W + H; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(0, i);
      ctx.stroke();
    }

    // Inner frame
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    const ink = "#211d18";
    const inkSoft = "#5a554d";
    const inkFaint = "#8a857c";

    // Number
    ctx.fillStyle = inkFaint;
    ctx.font = "500 22px Inter, sans-serif";
    const numText = poem.num.toUpperCase();
    ctx.fillText(numText, 90, 130);

    // Hairline
    ctx.strokeStyle = inkFaint;
    ctx.beginPath();
    ctx.moveTo(90, 150);
    ctx.lineTo(160, 150);
    ctx.stroke();

    // Title (italic serif)
    ctx.fillStyle = ink;
    ctx.font = "italic 300 86px 'Source Serif 4', Georgia, serif";
    ctx.fillText(poem.title, 90, 250);

    // Body — render fragment lines with line breaks, larger, centered vertically
    ctx.fillStyle = ink;
    ctx.font = "300 38px 'Source Serif 4', Georgia, serif";
    const startY = 420;
    const lineH = 60;
    lines.forEach((line, i) => {
      ctx.fillText(line, 90, startY + i * lineH);
    });

    // Footer — author + edition
    ctx.fillStyle = inkFaint;
    ctx.font = "500 18px Inter, sans-serif";
    ctx.fillText("EDITION OF 100", 90, H - 90);

    ctx.fillStyle = ink;
    ctx.font = "italic 300 36px 'Source Serif 4', Georgia, serif";
    const kText = "Kept";
    const kWidth = ctx.measureText(kText).width;
    ctx.fillText(kText, W - 90 - kWidth, H - 80);

    return canvas;
  };

  const downloadPNG = () => {
    const canvas = renderPrintCanvas(2);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `K_${poem.num}_${poem.title.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const downloadPDF = () => {
    // Use browser print of a bare HTML doc to PDF — opens a new window with just the print.
    const canvas = renderPrintCanvas(2);
    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${poem.title} — Kept</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; background: #f6f1e7; }
        .wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        img { width: 100%; max-width: 600px; height: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
        @media print { .wrap { padding: 0; } img { box-shadow: none; } }
      </style></head>
      <body><div class="wrap"><img src="${dataUrl}" alt="${poem.title}" /></div>
      <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className={`modal-backdrop ${open ? "is-open" : ""}`} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>

        <div className="modal-print">
          <div className="print-canvas" ref={printRef}>
            <div className="print-frame" />
            <div className="print-num">No. {poem.num}</div>
            <h3 className="print-title">{poem.title}</h3>
            <div className="print-body">
              {lines.map((line, i) => <p key={i}>{line}</p>)}
            </div>
            <div className="print-foot">
              <span>Edition of 100</span>
              <span className="print-mark">Kept</span>
            </div>
          </div>
        </div>

        <div className="modal-info">
          <div className="modal-eyebrow">Poem {poem.num}</div>
          <h2 className="modal-title">{poem.title}</h2>
          <div className="modal-poem-body">
            {poem.body
              ? poem.body.split("\n\n").map((stanza, si) => (
                  <p key={si}>
                    {stanza.split("\n").map((line, li, arr) => (
                      <React.Fragment key={li}>{line}{li < arr.length - 1 && <br />}</React.Fragment>
                    ))}
                  </p>
                ))
              : <span className="modal-poem-placeholder">—</span>
            }
          </div>

          <div className="modal-section-label">Print specifications</div>
          <div className="modal-specs">
            <div className="spec-item">
              <label>Format</label>
              <span>Digital print, 3:4</span>
            </div>
            <div className="spec-item">
              <label>Size</label>
              <span>A4 / 2400 × 3200 px</span>
            </div>
            <div className="spec-item">
              <label>Edition</label>
              <span>Of 100, signed</span>
            </div>
            <div className="spec-item">
              <label>Paper</label>
              <span>Cream archival</span>
            </div>
          </div>

          <div className="modal-section-label">Download</div>
          <div className="download-row">
            <button className="dl-btn primary" onClick={downloadPNG}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M6 1 V8 M3 5.5 L6 8.5 L9 5.5 M2 10 H10" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              PNG
            </button>
            <button className="dl-btn" onClick={downloadPDF}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M6 1 V8 M3 5.5 L6 8.5 L9 5.5 M2 10 H10" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PrintModal = PrintModal;
