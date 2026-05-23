/**
 * /billing/success — premium landing after Stripe Checkout.
 *
 * Reads ?session_id=cs_... → calls /api/billing/verify → cinematic reveal.
 */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Shield,
  Crown,
  ArrowRight,
  Sparkles,
  CreditCard,
} from "lucide-react";
import {
  IconPlan,
  IconStatus,
  IconCalendar,
  IconUnlimited,
  IconBranding,
  IconSupport,
  IconDashboard,
  IconClients,
  IconAnalytics,
  IconGeo,
  IconChatSupport,
  IconRocket,
} from "./icons";

type VerifyResult =
  | { ok: true; tier: string; status: string; currentPeriodEnd: string | null }
  | { ok: false; error?: string; paymentStatus?: string; status?: string };

/* ── Confetti ────────────────────────────────────────────────────────── */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rotation: number;
  rotationSpeed: number; opacity: number; shape: number;
}

function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef(0);

  const COLORS = [
    "#ff0000", "#ff3333", "#ff6666", "#3b82f6",
    "#3b82f6", "#ffffff", "#ef4444", "#1e40af",
  ];

  const burst = useCallback((ox: number, spread: number) => {
    const c = canvasRef.current;
    if (!c) return;
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      particles.current.push({
        x: ox, y: c.height * 0.35,
        vx: Math.cos(angle) * speed * spread,
        vy: Math.sin(angle) * speed - 4,
        size: Math.random() * 6 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        opacity: 1,
        shape: Math.floor(Math.random() * 3),
      });
    }
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      particles.current = particles.current.filter(p => p.opacity > 0.01);
      for (const p of particles.current) {
        p.x += p.vx; p.vy += 0.15; p.y += p.vy;
        p.vx *= 0.985; p.rotation += p.rotationSpeed;
        p.opacity *= 0.99;
        if (p.y > c.height + 20) p.opacity = 0;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 1) {
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf.current); };
  }, []);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const w = canvasRef.current.width;
    setTimeout(() => burst(w * 0.3, 1.2), 200);
    setTimeout(() => burst(w * 0.7, 1.2), 400);
    setTimeout(() => burst(w * 0.5, 1.5), 700);
    setTimeout(() => burst(w * 0.2, 0.8), 1100);
    setTimeout(() => burst(w * 0.8, 0.8), 1300);
  }, [active, burst]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}

/* ── Tier features ───────────────────────────────────────────────────── */

type FeatureIconComponent = (props: { className?: string; color?: string; colorEnd?: string }) => React.JSX.Element;

const TIER_FEATURES: Record<string, { icon: FeatureIconComponent; label: string; desc: string }[]> = {
  pro: [
    { icon: IconClients, label: "5 Client Accounts", desc: "Manage multiple campaigns simultaneously" },
    { icon: IconAnalytics, label: "Full Analytics Suite", desc: "Every breakdown and what-if explorer" },
    { icon: IconGeo, label: "Geographic Intelligence", desc: "Waste heatmaps and budget reallocation" },
    { icon: IconChatSupport, label: "Email + Chat Support", desc: "Get help when you need it" },
  ],
  agency: [
    { icon: IconUnlimited, label: "Unlimited Clients", desc: "No cap on accounts or audits" },
    { icon: IconBranding, label: "White-Label Branding", desc: "Your logo, your colors, your reports" },
    { icon: IconSupport, label: "Priority Support", desc: "Under 4-hour response time guaranteed" },
    { icon: IconDashboard, label: "Client Dashboards", desc: "Share read-only links with your clients" },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════ */

export default function BillingSuccessPage() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) { setState("error"); setErrorMsg("Missing session_id in URL."); return; }

    // Dev-only preview mode: ?session_id=preview_pro or preview_agency
    if (process.env.NODE_ENV === "development" && sessionId.startsWith("preview_")) {
      const tier = sessionId === "preview_agency" ? "agency" : "pro";
      const future = new Date(); future.setMonth(future.getMonth() + 1);
      setState("ok");
      setResult({ ok: true, tier, status: "active", currentPeriodEnd: future.toISOString() });
      setTimeout(() => setRevealed(true), 100);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`);
        const j = (await res.json().catch(() => ({}))) as VerifyResult & { error?: string };
        if (!res.ok || !(j as { ok?: boolean }).ok) {
          setState("error");
          setErrorMsg((j as { error?: string }).error ?? `Verification failed (HTTP ${res.status}).`);
          setResult(j); return;
        }
        setState("ok");
        setResult(j);
        // Stagger the reveal
        setTimeout(() => setRevealed(true), 100);
      } catch (err) {
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "Network error.");
      }
    })();
  }, []);

  const isAgency = result && "tier" in result && result.tier === "agency";
  const tierName = isAgency ? "Agency" : "Pro";
  const tierColor = isAgency ? "#3b82f6" : "#3b82f6";

  return (
    <>
      <Confetti active={state === "ok"} />

      <style jsx global>{`
        @keyframes s-wipe {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
        @keyframes s-up {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes s-scale {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes s-count {
          from { opacity: 0; transform: translateY(12px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes s-glow-line {
          0% { opacity: 0; width: 0; }
          50% { opacity: 1; }
          100% { opacity: 0.6; width: 100%; }
        }
        @keyframes s-badge-enter {
          from { opacity: 0; transform: translateY(-12px) scale(0.9); filter: blur(4px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes s-rocket-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-3px) rotate(1deg); }
          75% { transform: translateY(2px) rotate(-1deg); }
        }
        @keyframes s-shimmer {
          from { background-position: -200% center; }
          to { background-position: 200% center; }
        }
        @keyframes s-border-trace {
          0% { clip-path: inset(0 100% 100% 0); }
          25% { clip-path: inset(0 0 100% 0); }
          50% { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes s-number-pop {
          0% { transform: scale(0.3); opacity: 0; filter: blur(8px); }
          60% { transform: scale(1.1); filter: blur(0); }
          100% { transform: scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes s-line-draw {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes s-pulse-subtle {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
          50% { box-shadow: 0 0 20px 2px rgba(59,130,246,0.15); }
        }
        @keyframes s-loader-sweep {
          0% { left: -30%; }
          100% { left: 100%; }
        }
        .s-card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .s-card-hover:hover {
          transform: translateY(-2px);
          border-color: rgba(59,130,246,0.3);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
      `}</style>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-12">

        {/* ── Ambient background ─────────────────────────────────── */}
        {state === "ok" && (
          <>
            <div className="pointer-events-none absolute inset-0" style={{
              background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${tierColor}08 0%, transparent 60%)`,
            }} />
            <div className="pointer-events-none absolute inset-0" style={{
              background: `radial-gradient(circle at 20% 80%, ${tierColor}04 0%, transparent 40%), radial-gradient(circle at 80% 80%, ${tierColor}04 0%, transparent 40%)`,
            }} />
          </>
        )}

        <div className="relative z-10 w-full max-w-2xl">

          {/* ════ LOADING ══════════════════════════════════════════ */}
          {state === "loading" && (
            <div className="text-center">
              {/* Animated shield icon */}
              <div className="mx-auto mb-10 relative h-24 w-24">
                <div className="absolute inset-0 rounded-2xl border border-[var(--border)] bg-[var(--card)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard className="h-10 w-10 text-[var(--text-dim)]" />
                </div>
                {/* Sweep loader */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute inset-y-0 w-[30%] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent"
                    style={{ animation: "s-loader-sweep 1.5s ease-in-out infinite" }} />
                </div>
              </div>

              <h1 className="mb-2 text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-head)" }}>
                Processing your payment
              </h1>
              <p className="mb-8 text-sm text-[var(--text-dim)]">
                Confirming with Stripe. This takes a moment.
              </p>

              {/* Minimal loader bar */}
              <div className="mx-auto h-[2px] w-64 overflow-hidden bg-[var(--border)]">
                <div className="h-full bg-blue-500" style={{
                  animation: "s-wipe 2.5s ease-out forwards",
                }} />
              </div>
            </div>
          )}

          {/* ════ SUCCESS ═════════════════════════════════════════ */}
          {state === "ok" && result && "ok" in result && result.ok && (
            <div>
              {/* ── Top: Status line ─────────────────────────────── */}
              <div className="mb-12 text-center" style={{
                animation: revealed ? "s-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
                opacity: revealed ? undefined : 0,
              }}>
                {/* Tier badge */}
                <div className="mb-6" style={{
                  animation: revealed ? "s-badge-enter 0.5s ease-out 0.2s both" : "none",
                }}>
                  <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[3px]"
                    style={{ color: tierColor }}>
                    <span className="inline-block h-[1px] w-6" style={{ background: tierColor, opacity: 0.5 }} />
                    {isAgency ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {tierName} Plan Activated
                    <span className="inline-block h-[1px] w-6" style={{ background: tierColor, opacity: 0.5 }} />
                  </span>
                </div>

                {/* Big headline */}
                <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl" style={{
                  fontFamily: "var(--font-head)",
                  animation: revealed ? "s-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both" : "none",
                }}>
                  You&apos;re all set
                  <span style={{ color: tierColor }}>.</span>
                </h1>

                <p className="mx-auto max-w-md text-[var(--text-dim)] text-sm leading-relaxed" style={{
                  animation: revealed ? "s-up 0.5s ease-out 0.5s both" : "none",
                }}>
                  Your {tierName} subscription is live. Every audit tool, every breakdown, every insight
                  {isAgency ? " — plus white-label branding and unlimited clients" : ""} — ready to go.
                </p>
              </div>

              {/* ── Stat cards row ───────────────────────────────── */}
              <div className="mb-8 grid grid-cols-3 gap-3" style={{
                animation: revealed ? "s-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both" : "none",
              }}>
                {/* Plan */}
                <div className="s-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <IconPlan className="h-14 w-14" color="#ec4899" colorEnd="#a855f7" />
                    <span className="font-mono text-[8px] uppercase tracking-[2px] text-[var(--text-dim)]">Plan</span>
                  </div>
                  <div className="font-bold text-lg" style={{
                    fontFamily: "var(--font-head)",
                    animation: revealed ? "s-number-pop 0.5s ease-out 0.8s both" : "none",
                  }}>
                    {tierName}
                  </div>
                </div>

                {/* Status */}
                <div className="s-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <IconStatus className="h-14 w-14" />
                    <span className="font-mono text-[8px] uppercase tracking-[2px] text-[var(--text-dim)]">Status</span>
                  </div>
                  <div className="flex items-center gap-2" style={{
                    animation: revealed ? "s-number-pop 0.5s ease-out 0.9s both" : "none",
                  }}>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="font-bold text-lg text-emerald-400" style={{ fontFamily: "var(--font-head)" }}>
                      Active
                    </span>
                  </div>
                </div>

                {/* Next billing */}
                <div className="s-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <IconCalendar className="h-14 w-14" color="#ec4899" colorEnd="#f43f5e" />
                    <span className="font-mono text-[8px] uppercase tracking-[2px] text-[var(--text-dim)]">Renews</span>
                  </div>
                  <div className="font-bold text-lg" style={{
                    fontFamily: "var(--font-head)",
                    animation: revealed ? "s-number-pop 0.5s ease-out 1.0s both" : "none",
                  }}>
                    {result.currentPeriodEnd
                      ? new Date(result.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </div>
                </div>
              </div>

              {/* ── Unlocked features grid ───────────────────────── */}
              <div className="mb-8" style={{
                animation: revealed ? "s-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.9s both" : "none",
              }}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-[1px] flex-1 bg-[var(--border)]" />
                  <span className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--text-dim)]">
                    What&apos;s unlocked
                  </span>
                  <span className="h-[1px] flex-1 bg-[var(--border)]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(TIER_FEATURES[result.tier] ?? TIER_FEATURES.pro).map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <div
                        key={f.label}
                        className="s-card-hover group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                        style={{
                          animation: revealed
                            ? `s-count 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${1.1 + i * 0.1}s both`
                            : "none",
                        }}
                      >
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center transition-transform group-hover:scale-110">
                          <Icon className="h-20 w-20" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold leading-tight">{f.label}</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-dim)]">{f.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── CTA buttons ──────────────────────────────────── */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center" style={{
                animation: revealed ? "s-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 1.5s both" : "none",
              }}>
                <Link
                  href="/admin"
                  className="group relative flex items-center gap-3 overflow-hidden rounded-xl px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest text-white transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${tierColor}, #1e3a5f)`,
                    animation: "s-pulse-subtle 3s ease-in-out infinite 2s",
                  }}
                >
                  <span style={{ animation: "s-rocket-float 3s ease-in-out infinite", display: "inline-flex" }}>
                    <IconRocket className="h-10 w-10" />
                  </span>
                  <span>Launch Dashboard</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />

                  {/* Hover shimmer */}
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                      backgroundSize: "200% 100%",
                      animation: "s-shimmer 1.5s linear infinite",
                    }} />
                </Link>

                <Link
                  href="/admin/billing"
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Manage Billing
                </Link>
              </div>

              {/* ── Bottom note ───────────────────────────────────── */}
              <div className="mt-10 text-center" style={{
                animation: revealed ? "s-up 0.5s ease-out 1.8s both" : "none",
              }}>
                <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)] opacity-50">
                  Receipt sent to your email. Cancel or change plans anytime from billing settings.
                </p>
              </div>
            </div>
          )}

          {/* ════ ERROR ═══════════════════════════════════════════ */}
          {state === "error" && (
            <div className="text-center">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--red-dim)] bg-[rgba(255,0,0,0.04)]">
                <Shield className="h-9 w-9 text-[var(--red)]" />
              </div>
              <h1 className="mb-3 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-head)" }}>
                Something went wrong
              </h1>
              <p className="mb-2 text-sm text-[var(--text-dim)]">
                {errorMsg ?? "We couldn't verify your payment with Stripe."}
              </p>
              <p className="mb-10 font-mono text-[10px] text-[var(--text-dim)] opacity-50">
                If you were charged, reach out — we&apos;ll sort it out immediately.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/pricing"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--red)] px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-all hover:brightness-110">
                  Try Again
                </Link>
                <Link href="/"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-6 py-3.5 font-mono text-xs uppercase tracking-widest transition-all hover:border-[var(--text)]">
                  Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
