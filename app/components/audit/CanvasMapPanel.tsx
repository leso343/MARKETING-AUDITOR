"use client";

import { useEffect, useRef } from "react";
import { useLang } from "@/context/LangContext";

/* ── baked storm dataset (NCEI schema, last ~30 days, GA) ─────────────── */
const BAKED_STORMS: [number, number, "hail" | "wind", number, string, string][] = [
  [33.9526, -84.5499, "hail", 1.50, "2026-04-28", "Marietta"],
  [33.8400, -84.3800, "hail", 1.00, "2026-05-02", "Buckhead"],
  [33.6650, -84.0200, "hail", 1.25, "2026-04-22", "Conyers"],
  [33.9500, -83.9900, "wind", 70,   "2026-05-08", "Lawrenceville"],
  [33.3807, -84.7997, "hail", 0.88, "2026-04-19", "Newnan"],
  [33.5443, -84.2338, "hail", 1.00, "2026-05-05", "Stockbridge"],
  [33.9519, -83.3576, "wind", 65,   "2026-05-01", "Athens"],
  [34.0232, -84.3616, "hail", 1.75, "2026-04-25", "Roswell"],
  [33.7748, -84.2963, "wind", 60,   "2026-05-07", "Decatur"],
  [33.8081, -84.1702, "hail", 0.75, "2026-04-30", "Stone Mountain"],
  [34.2979, -83.8241, "hail", 2.00, "2026-04-18", "Gainesville"],
  [33.7048, -84.5440, "wind", 55,   "2026-05-09", "Douglasville"],
  [33.9595, -84.1107, "hail", 1.00, "2026-04-26", "Tucker"],
  [34.0754, -84.2941, "hail", 1.50, "2026-05-04", "Alpharetta"],
  [33.5807, -84.3216, "wind", 62,   "2026-04-23", "Forest Park"],
];

const LEAD_HEAT: [number, number, number][] = [
  [34.0232, -84.3616, 0.9],
  [33.9526, -84.5499, 0.75],
  [33.8481, -84.3733, 0.65],
  [33.7748, -84.2963, 0.6],
  [33.9595, -84.1107, 0.55],
  [34.0754, -84.2941, 0.7],
  [33.9280, -84.0200, 0.5],
  [33.5443, -84.2338, 0.35],
  [33.3807, -84.7997, 0.25],
  [34.2979, -83.8241, 0.15],
  [33.8781, -84.4619, 0.4],
  [33.8709, -84.2312, 0.45],
  [34.1010, -84.5190, 0.3],
  [33.6804, -84.1624, 0.3],
  [33.7048, -84.5440, 0.2],
];

const ATL: [number, number] = [33.7490, -84.3880];

type ScoredStorm = {
  lat: number; lng: number; type: "hail" | "wind"; mag: number;
  date: string; location: string; inHeat: boolean; score: number;
};

function scoreStorm(e: typeof BAKED_STORMS[0]): ScoredStorm {
  const dist = Math.sqrt((e[0] - ATL[0]) ** 2 + (e[1] - ATL[1]) ** 2);
  const heatBonus = Math.max(0, (0.40 - dist) / 0.40);
  const sev = e[2] === "hail" ? e[3] * 2 : Math.max(0.3, (e[3] - 50) / 15);
  return {
    lat: e[0], lng: e[1], type: e[2], mag: e[3], date: e[4], location: e[5],
    inHeat: heatBonus > 0.3,
    score: sev * (1 + heatBonus * 2),
  };
}

const SCORED = [...BAKED_STORMS.map(scoreStorm)].sort((a, b) => b.score - a.score);
const TOP5 = SCORED.slice(0, 5);

export default function CanvasMapPanel() {
  const { t } = useLang();
  const mapRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || !mapRef.current) return;
    initRef.current = true;

    (async () => {
      const L = (await import("leaflet")).default;
      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const el = mapRef.current!;
      el.innerHTML = "";
      const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: true })
        .setView([33.5, -83.9], 7);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 18,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>',
      }).addTo(map);

      /* Georgia outline */
      L.polygon([
        [34.99, -85.61], [34.99, -83.10], [34.49, -83.10], [33.97, -82.78],
        [33.51, -82.20], [32.78, -81.46], [32.04, -81.10], [31.40, -81.49],
        [30.72, -81.50], [30.72, -84.86], [30.99, -85.00], [31.62, -85.07],
        [32.46, -85.17], [33.13, -85.04], [34.27, -85.42], [34.99, -85.61],
      ], { color: "#3a3a44", weight: 1, dashArray: "3 3", fillOpacity: 0 }).addTo(map);

      /* Lead density heatmap via leaflet.heat CDN */
      const heatScript = document.createElement("script");
      heatScript.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
      heatScript.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (L as any).heatLayer(LEAD_HEAT, {
          radius: 40, blur: 30, maxZoom: 13, max: 1.0,
          gradient: { 0.0: "#000", 0.2: "#1a0000", 0.42: "#7c0000", 0.6: "#dc2626", 0.75: "#ea580c", 0.88: "#f59e0b", 1.0: "#fef08a" },
        }).addTo(map);
      };
      document.head.appendChild(heatScript);

      /* Atlanta label */
      L.marker(ATL, {
        icon: L.divIcon({
          html: '<div style="background:#0a0a0a;border:1px solid #F59E0B;color:#FCD34D;padding:2px 8px;border-radius:3px;font-family:monospace;font-size:10px;font-weight:900;white-space:nowrap">ATLANTA · 30 LEADS</div>',
          iconSize: [140, 18], iconAnchor: [70, 9], className: "",
        }),
      }).addTo(map);

      /* NC/SC waste marker */
      const leak: [number, number] = [34.85, -82.40];
      L.marker(leak, {
        icon: L.divIcon({
          html: '<div style="width:8px;height:8px;background:#60A5FA;border:1.5px solid #fff;border-radius:50%"></div>',
          iconSize: [8, 8], iconAnchor: [4, 4], className: "",
        }),
      }).addTo(map);
      L.marker(leak, {
        icon: L.divIcon({
          html: '<div style="background:#0a0a0a;border:1px solid #60A5FA;color:#93C5FD;padding:2px 8px;border-radius:3px;font-family:monospace;font-size:10px;font-weight:900;white-space:nowrap">$21.22 SPENT · 0 LEADS · NC/SC</div>',
          iconSize: [200, 18], iconAnchor: [100, -6], className: "",
        }),
      }).addTo(map);

      /* Storm markers */
      const stormLayer = L.featureGroup().addTo(map);
      SCORED.forEach((e, i) => {
        const rank = i + 1;
        const sevLabel = e.type === "hail" ? `${e.mag.toFixed(2)}" hail` : `${e.mag} mph wind`;
        const tip = `<b>#${rank} · ${e.location}</b><br>${sevLabel}<br>${e.date}${e.inHeat ? '<br><span style="color:#FCD34D">★ high-priority canvas</span>' : ""}`;

        if (rank <= 5) {
          const bg   = e.inHeat ? "#FCD34D" : "#9CA3AF";
          const ring = e.inHeat ? "#F59E0B" : "#525252";

          if (rank === 1 && e.inHeat) {
            L.marker([e.lat, e.lng], {
              icon: L.divIcon({
                html: '<div style="width:56px;height:56px;border-radius:50%;border:2.5px solid #F59E0B;animation:sna-canvas-pulse 1.8s ease-out infinite;position:absolute;top:-28px;left:-28px"></div>',
                iconSize: [0, 0], iconAnchor: [0, 0], className: "",
              }), zIndexOffset: -100,
            }).addTo(stormLayer);
          }

          L.marker([e.lat, e.lng], {
            icon: L.divIcon({
              html: `<div style="width:26px;height:26px;background:${bg};border:2.5px solid ${ring};color:#0a0a0a;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:900;font-size:14px;border-radius:50%;line-height:1">${rank}</div>`,
              iconSize: [26, 26], iconAnchor: [13, 13], className: "",
            }),
          }).addTo(stormLayer).bindTooltip(tip, { offset: [12, 0], direction: "right", sticky: true });
        } else {
          L.circleMarker([e.lat, e.lng], {
            radius: 6, color: "#6B7280", weight: 1.5, fillColor: "#9CA3AF", fillOpacity: 0.75,
          }).addTo(stormLayer).bindTooltip(tip, { offset: [8, 0], direction: "right", sticky: true });
        }
      });
    })();
  }, []);

  return (
    <div className="panel">
      <style>{`
        @keyframes sna-canvas-pulse {
          0%   { transform:scale(1);   opacity:.7 }
          70%  { transform:scale(2.4); opacity:0  }
          100% { transform:scale(1);   opacity:0  }
        }
        .leaflet-container { background: #030303; }
        .leaflet-tooltip { background:#111!important; border:1px solid #333!important; color:#fff!important; font-family:monospace; font-size:11px; }
        .leaflet-tooltip-left::before, .leaflet-tooltip-right::before { border-right-color:#333!important; border-left-color:#333!important; }
      `}</style>

      <div className="panel-label">{t("Canvas_Priority_Map", "Best Areas to Canvas")}</div>
      <h2 className="mb-1 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-head)" }}>
        {t("Best Areas to Canvas This Week", "Where to Send Door Knockers This Week")}
      </h2>
      <p className="mb-4 text-xs text-[var(--text-dim)]">
        {t(
          "Lead density heatmap × storm severity scoring. Top-5 pins ranked by impact.",
          "Heat shows where your leads came from. Numbered pins are recent storm zones ranked by door-knock priority.",
        )}
      </p>

      {/* Map */}
      <div ref={mapRef} style={{ height: 360, width: "100%", background: "#030303" }} />

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border border-[var(--border)] bg-black p-3">
        <div className="flex items-center gap-2">
          <div style={{ width: 44, height: 10, background: "linear-gradient(90deg,#7c0000,#dc2626,#f59e0b,#fef08a)", borderRadius: 2 }} />
          <span className="font-mono text-[10px] text-[var(--text-dim)]">Lead density</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 18, height: 18, background: "#FCD34D", border: "2px solid #F59E0B", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#0a0a0a" }}>1</div>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">Top-5 storm · high priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 18, height: 18, background: "#9CA3AF", border: "2px solid #525252", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#0a0a0a" }}>4</div>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">Top-5 storm · lower priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, background: "#9CA3AF", border: "1.5px solid #6B7280", borderRadius: "50%" }} />
          <span className="font-mono text-[10px] text-[var(--text-dim)]">Other recent storm</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, background: "#60A5FA", border: "1.5px solid #fff", borderRadius: "50%" }} />
          <span className="font-mono text-[10px] text-[var(--text-dim)]">Spent money, got no leads</span>
        </div>
      </div>

      {/* Priority list */}
      <div className="mt-4 border-l-2 border-[var(--red)] pl-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--red)]">
            ★ {t("Top Neighborhoods to Canvas This Week", "Top Door-Knock Zones This Week")}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] opacity-50">
            BAKED SNAPSHOT · NCEI SCHEMA
          </div>
        </div>
        <ol className="space-y-1.5">
          {TOP5.map((z, i) => {
            const sevLabel = z.type === "hail" ? `${z.mag.toFixed(2)}" hail` : `${z.mag} mph wind`;
            return (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                <span className="font-mono text-[10px] text-[var(--red)]">{i + 1}.</span>
                <span className="font-bold text-white">{z.location}</span>
                <span className="text-[var(--text-dim)]">— {sevLabel} · {z.date}</span>
                {z.inHeat ? (
                  <span className="font-mono text-[9px] font-extrabold tracking-wider" style={{ color: "#FCD34D" }}>★ HIGH PRIORITY</span>
                ) : (
                  <span className="font-mono text-[9px] text-[var(--text-dim)]">· lower priority</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
