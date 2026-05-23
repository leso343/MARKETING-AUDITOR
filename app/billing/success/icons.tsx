/**
 * Icons for the billing success page.
 * - Stat cards: hand-crafted SVG with gradient fills + glow (kept as-is)
 * - Feature cards: Higgsfield AI generated neon-glow PNGs
 * - Rocket CTA: Higgsfield AI generated
 */
import Image from "next/image";

interface IconProps {
  className?: string;
  color?: string;
  colorEnd?: string;
}

const defaults = { color: "#3b82f6", colorEnd: "#60a5fa" };

/* ═══════════════════════════════════════════════════════════════════════
   STAT CARD ICONS — SVG (user wants these kept as-is)
   ═══════════════════════════════════════════════════════════════════════ */

export function IconPlan({ className, color = defaults.color, colorEnd = defaults.colorEnd }: IconProps) {
  const id = "grad-plan";
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} />
          <stop offset="1" stopColor={colorEnd} />
        </linearGradient>
        <filter id="glow-plan">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g filter="url(#glow-plan)">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          stroke={`url(#${id})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M12 6L13.545 9.13L17 9.635L14.5 12.07L15.09 15.51L12 13.885L8.91 15.51L9.5 12.07L7 9.635L10.455 9.13L12 6Z"
          fill={`url(#${id})`} opacity="0.25" />
      </g>
    </svg>
  );
}

export function IconStatus({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-status" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#6ee7b7" />
        </linearGradient>
        <filter id="glow-status">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g filter="url(#glow-status)">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="url(#grad-status)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M22 4L12 14.01l-3-3" stroke="url(#grad-status)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" fill="url(#grad-status)" opacity="0.15" />
      </g>
    </svg>
  );
}

export function IconCalendar({ className, color = defaults.color, colorEnd = defaults.colorEnd }: IconProps) {
  const id = "grad-cal";
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} />
          <stop offset="1" stopColor={colorEnd} />
        </linearGradient>
        <filter id="glow-cal">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g filter="url(#glow-cal)">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke={`url(#${id})`} strokeWidth="1.5" fill="none" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke={`url(#${id})`} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="7" y="14" width="4" height="4" rx="1" fill={`url(#${id})`} opacity="0.3" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FEATURE CARD ICONS — Higgsfield AI generated PNGs (transparent bg)
   ═══════════════════════════════════════════════════════════════════════ */

export function IconClients({ className }: IconProps) {
  return (
    <Image src="/icons/clients.png?v=6" alt="Client Accounts" width={160} height={160}
      className={className} style={{ objectFit: "contain" }} />
  );
}

export function IconAnalytics({ className }: IconProps) {
  return (
    <Image src="/icons/analytics.png?v=6" alt="Analytics" width={160} height={160}
      className={className} style={{ objectFit: "contain" }} />
  );
}

export function IconGeo({ className }: IconProps) {
  return (
    <Image src="/icons/geo.png?v=6" alt="Geographic Intelligence" width={160} height={160}
      className={className} style={{ objectFit: "contain" }} />
  );
}

export function IconChatSupport({ className }: IconProps) {
  return (
    <Image src="/icons/chat.png?v=6" alt="Chat Support" width={160} height={160}
      className={className} style={{ objectFit: "contain" }} />
  );
}

export function IconUnlimited({ className }: IconProps) {
  return (
    <Image src="/icons/unlimited.png?v=6" alt="Unlimited" width={160} height={160}
      className={className} style={{ objectFit: "contain" }} />
  );
}

export function IconBranding({ className }: IconProps) {
  return (
    <Image src="/icons/branding.png?v=6" alt="Branding" width={160} height={160}
      className={className} style={{ objectFit: "contain", filter: "hue-rotate(270deg) saturate(1.4) brightness(1.1)" }} />
  );
}

export function IconSupport({ className }: IconProps) {
  return (
    <Image src="/icons/support.png?v=6" alt="Priority Support" width={160} height={160}
      className={className} style={{ objectFit: "contain", filter: "hue-rotate(180deg) saturate(1.5) brightness(1.2)" }} />
  );
}

export function IconDashboard({ className }: IconProps) {
  return (
    <Image src="/icons/dashboard.png?v=6" alt="Dashboard" width={160} height={160}
      className={className} style={{ objectFit: "contain", filter: "hue-rotate(60deg) saturate(1.3)" }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROCKET CTA — Higgsfield AI generated
   ═══════════════════════════════════════════════════════════════════════ */

export function IconRocket({ className }: IconProps) {
  return (
    <Image src="/icons/rocket.png?v=6" alt="Launch" width={160} height={160}
      className={className} style={{ objectFit: "contain" }} />
  );
}
