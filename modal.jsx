// Modal — left: video with poem overlaid. Right (or below on mobile): print image + download.

const { useEffect, useRef } = React;

function PrintModal({ poem, open, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  }, [open, poem]);

  if (!poem) return null;

  return (
    <div className={`modal-backdrop ${open ? "is-open" : ""}`} onClick={onClose}>
      <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>

        {/* Left — video with poem overlaid */}
        <div className="modal-media">
          {poem.video && (
            <video className="modal-video" src={poem.video} autoPlay loop muted playsInline />
          )}
          <div className="modal-poem">
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
          </div>
        </div>

        {/* Right — print image + single download button */}
        <div className="modal-print">
          {poem.image && (
            <div className="modal-print-image-wrap">
              <img className="modal-print-image" src={poem.image} alt={poem.title} />
            </div>
          )}
          {poem.image && (
            <div className="modal-print-info">
              <a
                className="dl-btn primary"
                href={poem.image}
                download={`${poem.num}_${poem.title.replace(/\s+/g, "_")}.png`}
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M6 1 V8 M3 5.5 L6 8.5 L9 5.5 M2 10 H10" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download original PNG
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.PrintModal = PrintModal;
