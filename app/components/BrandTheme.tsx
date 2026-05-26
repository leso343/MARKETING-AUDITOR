/**
 * BrandTheme — agency-driven CSS custom-property overrides.
 *
 * Token mapping:
 *   --red / --red-dim          ← primaryColor (the dominant brand accent)
 *   --brand-secondary(-dim)    ← secondaryColor
 *   --brand-accent(-dim)       ← accentColor
 *   --brand-highlight(-dim)    ← highlightColor
 *   --brand-pop(-dim)          ← popColor
 *   --bg / --card / --border / --sidebar / --header-bg  ← derived from bgColor
 *   --text / --text-dim        ← auto-flipped to dark when bgColor is light
 *
 * Previously this component only overrode the brand-color tokens, which
 * meant the dominant surface colors (--bg/--card/--border, used by every
 * panel) kept their defaults. Saving a palette would change buttons and
 * a few accents but the whole dashboard still looked like the default.
 *
 * The bgColor slot fixes that: pick one background colour and we derive
 * card / border / sidebar shades automatically, plus flip text contrast.
 */

interface BrandThemeProps {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  highlightColor?: string | null;
  popColor?: string | null;
  bgColor?: string | null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nr = Math.min(255, Math.round(r + (255 - r) * amount));
  const ng = Math.min(255, Math.round(g + (255 - g) * amount));
  const nb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Perceived luminance 0..1 (Rec. 601). */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Pick a "next shade up" for surfaces. On dark backgrounds we LIGHTEN
 * (so cards stand out brighter than the page). On light backgrounds we
 * DARKEN (so cards stand out darker than the page).
 */
function surfaceShade(hex: string, amount: number): string {
  return luminance(hex) > 0.5 ? darken(hex, amount) : lighten(hex, amount);
}

export default function BrandTheme({
  primaryColor,
  secondaryColor,
  accentColor,
  highlightColor,
  popColor,
  bgColor,
}: BrandThemeProps) {
  // Nothing to do when no colors at all are set.
  if (!primaryColor && !bgColor) return null;

  const primary = primaryColor ?? "#ff0000";
  const secondary = secondaryColor || primary;
  const accent = accentColor || primary;
  const highlight = highlightColor || "#ff6b35";
  const pop = popColor || "#ffd700";

  const primaryDark = darken(primary, 0.5);
  const primaryLight = lighten(primary, 0.2);

  // ── Surface derivation from bgColor ────────────────────────────────
  // Defaults match the original globals.css tokens:
  //   --bg #030303  --sidebar #060606  --card #0a0a0a  --border #151515
  const bg = bgColor ?? null;
  const isLightBg = bg ? luminance(bg) > 0.5 : false;

  // Compute surface shades only when bg is explicitly set
  const sidebar  = bg ? surfaceShade(bg, 0.025) : null;
  const card     = bg ? surfaceShade(bg, 0.05)  : null;
  const border   = bg ? surfaceShade(bg, 0.10)  : null;

  // Text contrast — flip to dark on light bg
  const text     = bg ? (isLightBg ? "#0f172a" : "#ffffff") : null;
  const textDim  = bg ? (isLightBg ? "#475569" : "#a0a0a0") : null;
  const headerBg = bg ? hexToRgba(bg, 0.95) : null;

  // Build the override block. We override BOTH :root (dark default) and
  // html.light so the theme toggle still works — the brand colors are
  // identical, but the surface shades use the same agency-picked bg.
  const surfaceBlock = bg
    ? `
      --bg: ${bg};
      --sidebar: ${sidebar};
      --card: ${card};
      --border: ${border};
      --text: ${text};
      --text-dim: ${textDim};
      --header-bg: ${headerBg};`
    : "";

  const css = `
    :root {
      --red: ${primary};
      --red-dim: ${hexToRgba(primary, 0.1)};
      --brand-secondary: ${secondary};
      --brand-secondary-dim: ${hexToRgba(secondary, 0.1)};
      --brand-accent: ${accent};
      --brand-accent-dim: ${hexToRgba(accent, 0.1)};
      --brand-highlight: ${highlight};
      --brand-highlight-dim: ${hexToRgba(highlight, 0.1)};
      --brand-pop: ${pop};
      --brand-pop-dim: ${hexToRgba(pop, 0.1)};${surfaceBlock}
    }
    html.light {
      --red: ${primary};
      --red-dim: ${hexToRgba(primary, 0.08)};
      --brand-secondary: ${secondary};
      --brand-secondary-dim: ${hexToRgba(secondary, 0.08)};
      --brand-accent: ${accent};
      --brand-accent-dim: ${hexToRgba(accent, 0.08)};
      --brand-highlight: ${highlight};
      --brand-highlight-dim: ${hexToRgba(highlight, 0.08)};
      --brand-pop: ${pop};
      --brand-pop-dim: ${hexToRgba(pop, 0.08)};${surfaceBlock}
    }

    /* Body and html backgrounds use default tokens, so force them
       when bgColor is set so the page edge matches every surface. */
    ${bg ? "html, body { background: var(--bg) !important; color: var(--text); }" : ""}

    /* Scrollbar branding */
    * { scrollbar-color: ${primary} var(--bg); }
    *::-webkit-scrollbar-thumb { background: ${primary} !important; }
    html.is-scrolling *::-webkit-scrollbar-thumb:vertical {
      background: ${primary} !important;
    }
    html.is-scrolling::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg,
        ${primaryDark} 0%,
        ${primary} 40%,
        ${primaryLight} 60%,
        ${primaryDark} 100%
      ) !important;
      box-shadow:
        0 0 8px  ${hexToRgba(primary, 0.7)},
        0 0 18px ${hexToRgba(primary, 0.3)},
        inset 0 0 3px ${hexToRgba(accent, 0.35)} !important;
    }
    html.is-scrolling::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg,
        ${primary} 0%,
        ${primaryLight} 40%,
        ${lighten(primary, 0.35)} 60%,
        ${primary} 100%
      ) !important;
      box-shadow:
        0 0 14px ${hexToRgba(primary, 1)},
        0 0 28px ${hexToRgba(primary, 0.45)},
        inset 0 0 5px ${hexToRgba(accent, 0.55)} !important;
    }
    html.is-scrolling::-webkit-scrollbar-track {
      box-shadow: inset -1px 0 0 ${hexToRgba(primary, 0.12)} !important;
    }

    /* Slider thumbs */
    .range-input::-webkit-slider-thumb {
      background: ${primary} !important;
      box-shadow: 0 0 8px ${hexToRgba(primary, 0.5)} !important;
    }
    .range-input::-moz-range-thumb {
      background: ${primary} !important;
    }

    /* Status colors */
    .status-critical { color: ${primary} !important; }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
