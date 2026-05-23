"use client";

/**
 * Blank Page Audits — brand logo.
 *
 * A blank page with a red magnifying glass, plus the wordmark.
 * Use `showText={false}` for icon-only contexts (e.g. client card tiles).
 */
export default function Logo({
  className = "",
  showText = true,
  size = "md",
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: 28, md: 40, lg: 56 }[size];
  const textSize = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];
  const subSize = { sm: "text-[7px]", md: "text-[9px]", lg: "text-[11px]" }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Blank Page Audits logo"
      >
        {/* Page */}
        <rect
          x="10"
          y="4"
          width="32"
          height="42"
          rx="3"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="2"
        />
        {/* Dog-ear fold */}
        <path d="M32 4 L42 4 L42 14 Z" fill="#334155" stroke="#475569" strokeWidth="1" />
        {/* Text lines on page */}
        <rect x="16" y="18" width="20" height="2" rx="1" fill="#475569" />
        <rect x="16" y="24" width="15" height="2" rx="1" fill="#475569" />
        <rect x="16" y="30" width="18" height="2" rx="1" fill="#475569" />
        <rect x="16" y="36" width="12" height="2" rx="1" fill="#475569" />

        {/* Magnifying glass — positioned bottom-right overlapping the page */}
        <circle
          cx="44"
          cy="44"
          r="11"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
        />
        {/* Glass fill — subtle */}
        <circle cx="44" cy="44" r="9" fill="#ef444415" />
        {/* Handle */}
        <line
          x1="52"
          y1="52"
          x2="60"
          y2="60"
          stroke="#ef4444"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Checkmark inside glass */}
        <path
          d="M38 44 L42 48 L50 40"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={`${textSize} font-bold tracking-tight`}
            style={{ fontFamily: "var(--font-head)" }}
          >
            BLANK PAGE
          </span>
          <span
            className={`${subSize} font-mono uppercase tracking-[3px] text-[var(--red)]`}
          >
            Audits
          </span>
        </div>
      )}
    </div>
  );
}
