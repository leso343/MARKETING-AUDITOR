import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Blank Page Audits — Forensic Ad Intelligence";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#030303",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #ff0000, #ef4444, #ff0000)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="10" y="4" width="32" height="42" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <path d="M32 4 L42 4 L42 14 Z" fill="#334155" />
            <rect x="16" y="18" width="20" height="2" rx="1" fill="#475569" />
            <rect x="16" y="24" width="15" height="2" rx="1" fill="#475569" />
            <rect x="16" y="30" width="18" height="2" rx="1" fill="#475569" />
            <rect x="16" y="36" width="12" height="2" rx="1" fill="#475569" />
            <circle cx="44" cy="44" r="11" fill="none" stroke="#ef4444" strokeWidth="3" />
            <circle cx="44" cy="44" r="9" fill="rgba(239,68,68,0.08)" />
            <line x1="52" y1="52" x2="60" y2="60" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M38 44 L42 48 L50 40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: "#ffffff", letterSpacing: "-2px" }}>
            BLANK PAGE AUDITS
          </div>
          <div style={{ fontSize: 16, color: "#ef4444", letterSpacing: "6px", textTransform: "uppercase" }}>
            Forensic Ad Intelligence
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 20, color: "#a0a0a0", maxWidth: 600, textAlign: "center", lineHeight: 1.5 }}>
          Surface budget leaks, funnel gaps, and wasted spend.
        </div>

        <div style={{ position: "absolute", bottom: 20, fontSize: 13, color: "#475569", letterSpacing: "3px", textTransform: "uppercase" }}>
          blankpageaudits.app
        </div>
      </div>
    ),
    { ...size }
  );
}
