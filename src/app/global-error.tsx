"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#060910", color: "#e6edf6", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>MeshVigil failed to start</h1>
            <p style={{ color: "#9fb0c3", marginBottom: 16 }}>A fatal error occurred before the console could mount.</p>
            {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#64768c" }}>digest: {error.digest}</p>}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(52,229,198,0.4)",
                background: "rgba(52,229,198,0.1)",
                color: "#34e5c6",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
