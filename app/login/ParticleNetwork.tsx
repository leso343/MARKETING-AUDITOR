"use client";
import { useEffect, useRef, useCallback } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  origX: number;
  origY: number;
  cluster: number;
  r: number;
  phase: number;
}

const COLORS: [number, number, number][] = [
  [255, 40, 80],
  [30, 120, 255],
  [40, 220, 120],
  [255, 170, 20],
  [160, 50, 255],
  [255, 40, 160],
  [20, 200, 240],
  [180, 230, 30],
  [255, 90, 40],
];

const CLUSTERS = [
  { x: 0.20, y: 0.13, n: 300, s: 1.05 },
  { x: 0.62, y: 0.10, n: 220, s: 0.85 },
  { x: 0.88, y: 0.24, n: 180, s: 0.75 },
  { x: 0.38, y: 0.38, n: 340, s: 1.15 },
  { x: 0.76, y: 0.42, n: 260, s: 0.95 },
  { x: 0.14, y: 0.58, n: 240, s: 0.90 },
  { x: 0.52, y: 0.62, n: 300, s: 1.05 },
  { x: 0.28, y: 0.80, n: 220, s: 0.85 },
  { x: 0.73, y: 0.80, n: 200, s: 0.80 },
];

export default function ParticleNetwork() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Uint32Array>(new Uint32Array(0));
  const ecRef = useRef(0);
  const dragRef = useRef<{
    idx: number; ox: number; oy: number;
    prevX: number; prevY: number; throwVx: number; throwVy: number;
  } | null>(null);
  const szRef = useRef({ w: 0, h: 0 });
  const fRef = useRef(0);

  const build = useCallback(() => {
    const w = szRef.current.w;
    const h = szRef.current.h;
    if (!w || !h) return;

    const nodes: Node[] = [];
    const pairs: number[] = [];
    const base = w * 0.15;
    const clusterStarts: number[] = [];

    CLUSTERS.forEach((cl, ci) => {
      const cx = cl.x * w;
      const cy = cl.y * h;
      const spread = base * cl.s;
      clusterStarts.push(nodes.length);

      for (let i = 0; i < cl.n; i++) {
        const u1 = Math.random() || 0.001;
        const u2 = Math.random();
        const mag = spread * Math.sqrt(-2 * Math.log(u1)) * 0.30;
        const angle = Math.PI * 2 * u2;
        const nx = cx + Math.cos(angle) * mag;
        const ny = cy + Math.sin(angle) * mag;
        nodes.push({
          x: nx, y: ny, vx: 0, vy: 0,
          origX: nx, origY: ny, cluster: ci,
          r: 0.4 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
        });
      }

      const start = clusterStarts[ci];
      const slice = nodes.slice(start);
      const len = slice.length;
      for (let i = 0; i < len; i++) {
        const ni = slice[i];
        const dists: { idx: number; d: number }[] = [];
        for (let j = 0; j < len; j++) {
          if (i === j) continue;
          const dx = ni.x - slice[j].x;
          const dy = ni.y - slice[j].y;
          dists.push({ idx: j, d: dx * dx + dy * dy });
        }
        dists.sort((a, b) => a.d - b.d);
        const k = 5 + Math.floor(Math.random() * 5);
        for (let n = 0; n < Math.min(k, dists.length); n++) {
          const ai = start + i;
          const bi = start + dists[n].idx;
          if (ai < bi) pairs.push(ai, bi);
        }
      }
    });

    const set = new Set<number>();
    const clean: number[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i], b = pairs[i + 1];
      const key = a * 100000 + b;
      if (!set.has(key)) { set.add(key); clean.push(a, b); }
    }

    for (let i = 0; i < CLUSTERS.length; i++) {
      for (let j = i + 1; j < CLUSTERS.length; j++) {
        const dx = (CLUSTERS[i].x - CLUSTERS[j].x) * w;
        const dy = (CLUSTERS[i].y - CLUSTERS[j].y) * h;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < w * 0.55) {
          const startI = clusterStarts[i];
          const startJ = clusterStarts[j];
          const cntI = CLUSTERS[i].n;
          const cntJ = CLUSTERS[j].n;
          const proximity = 1 - dist / (w * 0.55);
          const bridgeCount = Math.floor(25 + proximity * 70);
          for (let b = 0; b < bridgeCount; b++) {
            const ai = startI + Math.floor(Math.random() * cntI);
            const bi = startJ + Math.floor(Math.random() * cntJ);
            clean.push(Math.min(ai, bi), Math.max(ai, bi));
          }
        }
      }
    }

    nodesRef.current = nodes;
    edgesRef.current = new Uint32Array(clean);
    ecRef.current = clean.length / 2;
  }, []);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    const bloom = document.createElement("canvas");
    const bctx = bloom.getContext("2d", { alpha: true })!;
    let animId: number;
    let dpr = 1;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const r = cv!.parentElement!.getBoundingClientRect();
      szRef.current = { w: r.width, h: r.height };
      cv!.width = r.width * dpr;
      cv!.height = r.height * dpr;
      cv!.style.width = r.width + "px";
      cv!.style.height = r.height + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      bloom.width = r.width;
      bloom.height = r.height;
    }

    function init() { resize(); build(); }

    function simulate() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const ec = ecRef.current;
      const drag = dragRef.current;
      const t = fRef.current * 0.006;

      for (let i = 0; i < ec; i++) {
        const ai = edges[i * 2], bi = edges[i * 2 + 1];
        const a = nodes[ai], b = nodes[bi];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const same = a.cluster === b.cluster;
        const restLen = same ? 12 : 50;
        const k = same ? 0.005 : 0.002;
        const f = (dist - restLen) * k;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.vx += (n.origX - n.x) * 0.015;
        n.vy += (n.origY - n.y) * 0.015;

        // Cluster-wide slow drift (conjoined swaying)
        const ct = t * 0.12 + n.cluster * 2.1;
        n.vx += Math.sin(ct) * 0.10;
        n.vy += Math.cos(ct * 0.7) * 0.08;
        // Per-node 3D orbital (elliptical = tilted circle illusion)
        const ot = t * 0.06 + n.phase;
        n.vx += Math.cos(ot) * 0.025;
        n.vy += Math.sin(ot * 1.3) * 0.018;

        if (drag && drag.idx === i) continue;

        n.vx *= 0.93;
        n.vy *= 0.93;
        n.x += n.vx;
        n.y += n.vy;
      }

      if (drag) {
        const n = nodes[drag.idx];
        drag.throwVx = 0.3 * drag.throwVx + 0.7 * (n.x - drag.prevX);
        drag.throwVy = 0.3 * drag.throwVy + 0.7 * (n.y - drag.prevY);
        drag.prevX = n.x;
        drag.prevY = n.y;
      }
    }

    function draw() {
      const w = szRef.current.w, h = szRef.current.h;
      if (!w || !h || !bloom.width || !bloom.height) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const ec = ecRef.current;
      const drag = dragRef.current;
      const t = fRef.current * 0.012;
      const base = w * 0.15;

      ctx!.clearRect(0, 0, w, h);
      bctx!.clearRect(0, 0, w, h);
      bctx!.globalCompositeOperation = "lighter";

      // ── Edges on bloom canvas — batched by cluster ──
      for (let ci = 0; ci < CLUSTERS.length; ci++) {
        const col = COLORS[ci];
        bctx!.beginPath();
        for (let i = 0; i < ec; i++) {
          const ai = edges[i * 2], bi = edges[i * 2 + 1];
          const a = nodes[ai], b = nodes[bi];
          if (a.cluster !== ci || a.cluster !== b.cluster) continue;
          bctx!.moveTo(a.x, a.y);
          bctx!.lineTo(b.x, b.y);
        }
        bctx!.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.25)`;
        bctx!.lineWidth = 0.6;
        bctx!.stroke();
      }

      // Inter-cluster edges — batched by lower cluster for color
      for (let ci = 0; ci < CLUSTERS.length; ci++) {
        const col = COLORS[ci];
        bctx!.beginPath();
        let has = false;
        for (let i = 0; i < ec; i++) {
          const ai = edges[i * 2], bi = edges[i * 2 + 1];
          const a = nodes[ai], b = nodes[bi];
          if (a.cluster === b.cluster) continue;
          if (Math.min(a.cluster, b.cluster) !== ci) continue;
          bctx!.moveTo(a.x, a.y);
          bctx!.lineTo(b.x, b.y);
          has = true;
        }
        if (!has) continue;
        bctx!.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.15)`;
        bctx!.lineWidth = 1.0;
        bctx!.stroke();
      }

      // ── Cluster core glows ──
      for (let ci = 0; ci < CLUSTERS.length; ci++) {
        const col = COLORS[ci];
        const cx = CLUSTERS[ci].x * w;
        const cy = CLUSTERS[ci].y * h;
        const coreR = base * CLUSTERS[ci].s * 0.45;
        const grad = bctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.18)`);
        grad.addColorStop(0.3, `rgba(${col[0]},${col[1]},${col[2]},0.07)`);
        grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        bctx!.beginPath();
        bctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
        bctx!.fillStyle = grad;
        bctx!.fill();
      }

      // ── Node glows on bloom canvas ──
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const col = COLORS[n.cluster % COLORS.length];
        const pulse = 1 + Math.sin(t + n.phase) * 0.1;
        const glowR = (n.r * 5 + 5) * pulse;
        const ga = 0.05;
        const grad = bctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${ga})`);
        grad.addColorStop(0.4, `rgba(${col[0]},${col[1]},${col[2]},${ga * 0.5})`);
        grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        bctx!.beginPath();
        bctx!.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        bctx!.fillStyle = grad;
        bctx!.fill();
      }

      bctx!.globalCompositeOperation = "source-over";

      // ── Bloom compositing: 3 passes ──
      ctx!.globalCompositeOperation = "lighter";

      ctx!.save();
      ctx!.filter = `blur(${Math.round(22 * dpr)}px)`;
      ctx!.globalAlpha = 0.55;
      ctx!.drawImage(bloom, 0, 0);
      ctx!.restore();

      ctx!.save();
      ctx!.filter = `blur(${Math.round(7 * dpr)}px)`;
      ctx!.globalAlpha = 0.75;
      ctx!.drawImage(bloom, 0, 0);
      ctx!.restore();

      ctx!.globalAlpha = 1;
      ctx!.drawImage(bloom, 0, 0);

      // ── Sharp node dots ──
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const col = COLORS[n.cluster % COLORS.length];
        const isDragged = drag && drag.idx === i;
        const r = isDragged ? n.r * 2.5 : n.r;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = isDragged
          ? "rgba(255,255,255,0.95)"
          : `rgba(${col[0]},${col[1]},${col[2]},${0.7 + n.r * 0.1})`;
        ctx!.fill();
      }

      ctx!.globalCompositeOperation = "source-over";
      ctx!.globalAlpha = 1;

      // ── Drag highlight ──
      if (drag) {
        const dn = nodes[drag.idx];
        for (let i = 0; i < ec; i++) {
          const ai = edges[i * 2], bi = edges[i * 2 + 1];
          if (ai !== drag.idx && bi !== drag.idx) continue;
          const a = nodes[ai], b = nodes[bi];
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.strokeStyle = "rgba(255,255,255,0.35)";
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
        ctx!.beginPath();
        ctx!.arc(dn.x, dn.y, 18, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(255,255,255,0.3)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      fRef.current++;
    }

    function loop() { simulate(); draw(); animId = requestAnimationFrame(loop); }

    function pos(e: MouseEvent | TouchEvent) {
      const r = cv!.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const cy = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      return { x: cx - r.left, y: cy - r.top };
    }

    function hit(x: number, y: number): number {
      let best = -1, bestD = 30;
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - x, dy = nodes[i].y - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) { best = i; bestD = d; }
      }
      return best;
    }

    function onDown(e: MouseEvent | TouchEvent) {
      const p = pos(e);
      const idx = hit(p.x, p.y);
      if (idx >= 0) {
        const n = nodesRef.current[idx];
        dragRef.current = {
          idx, ox: n.x - p.x, oy: n.y - p.y,
          prevX: n.x, prevY: n.y, throwVx: 0, throwVy: 0,
        };
        cv!.style.cursor = "grabbing";
        e.preventDefault();
      }
    }

    function onMove(e: MouseEvent | TouchEvent) {
      const p = pos(e);
      const d = dragRef.current;
      if (d) {
        const n = nodesRef.current[d.idx];
        n.x = p.x + d.ox;
        n.y = p.y + d.oy;
        n.vx = 0;
        n.vy = 0;
        e.preventDefault();
      } else {
        cv!.style.cursor = hit(p.x, p.y) >= 0 ? "grab" : "default";
      }
    }

    function onUp() {
      const d = dragRef.current;
      if (d) {
        const n = nodesRef.current[d.idx];
        n.vx = d.throwVx * 8;
        n.vy = d.throwVy * 8;
        cv!.style.cursor = "default";
        dragRef.current = null;
      }
    }

    function onLeave() {
      if (dragRef.current) {
        const d = dragRef.current;
        const n = nodesRef.current[d.idx];
        n.vx = d.throwVx * 3;
        n.vy = d.throwVy * 3;
        dragRef.current = null;
        cv!.style.cursor = "default";
      }
    }

    init();
    loop();

    cv.addEventListener("mousedown", onDown);
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mouseup", onUp);
    cv.addEventListener("mouseleave", onLeave);
    cv.addEventListener("touchstart", onDown, { passive: false });
    cv.addEventListener("touchmove", onMove, { passive: false });
    cv.addEventListener("touchend", onUp);

    let rt: ReturnType<typeof setTimeout>;
    const onR = () => { clearTimeout(rt); rt = setTimeout(init, 200); };
    window.addEventListener("resize", onR);

    return () => {
      cancelAnimationFrame(animId);
      bloom.width = 0;
      bloom.height = 0;
      cv.removeEventListener("mousedown", onDown);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mouseup", onUp);
      cv.removeEventListener("mouseleave", onLeave);
      cv.removeEventListener("touchstart", onDown);
      cv.removeEventListener("touchmove", onMove);
      cv.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", onR);
      clearTimeout(rt);
    };
  }, [build]);

  return (
    <canvas
      ref={cvRef}
      className="absolute inset-0"
      style={{ display: "block" }}
    />
  );
}
