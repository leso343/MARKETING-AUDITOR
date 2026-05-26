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
 *
 * IMPORTANT — ThemeToggle co-existence:
 *   ThemeToggle adds/removes the `html.light` class on <html>.
 *   globals.css defines :root (dark) and html.light (light) surfaces.
 *   BrandTheme must NOT put the same surface values into both blocks —
 *   that would make the toggle a no-op. Instead we compute TWO distinct
 *   surface palettes:
 *     • darkSurfaces  → applied to :root    (dark mode)
 *     • lightSurfaces → applied to html.light (light mode)
 *   --text / --text-dim are intentionally left to globals.css /
 *   ThemeToggle — we never override those here.
 *   No `!important` on html/body background — that would prevent the
 *   `html.light body { background: var(--bg) }` rule in globals.css
 *   from working.
 */

interface BrandThemeProps {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  highlightColor?: string | null;
  popColor?: string | null;
  bgColor?: string | null;
  /**
   * Optional manual overrides for surface tokens. When omitted, the
   * corresponding token is auto-derived from bgColor via surfaceShade.
   * When set, the agency's explicit color wins — useful when the
   * auto-derived combo doesn't have enough contrast.
   */
  cardColor?: string | null;
  borderColor?: string | null;
  textColor?: string | null;
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

/** Build a CSS surface block for a given bg color, with optional
 *  per-token manual overrides. Any override that's null/undefined
 *  falls back to the auto-derived surfaceShade value. textColor is
 *  intentionally NOT emitted here — globals.css owns --text via the
 *  html.light toggle. textColor override is handled separately. */
function buildSurfaces(
  bg: string,
  overrides?: { card?: string | null; border?: string | null }
): string {
  const card = overrides?.card || surfaceShade(bg, 0.05);
  const border = overrides?.border || surfaceShade(bg, 0.10);
  return `
      --bg: ${bg};
      --sidebar: ${surfaceShade(bg, 0.025)};
      --card: ${card};
      --border: ${border};
      --header-bg: ${hexToRgba(bg, 0.95)};`;
}

export default function BrandTheme({
  primaryColor,
  secondaryColor,
  accentColor,
  highlightColor,
  popColor,
  bgColor,
  cardColor,
  borderColor,
  textColor,
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
  // Compute two distinct bg palettes so each theme mode gets different surfaces.
  // This is the key fix: :root and html.light must NOT share the same values,
  // otherwise the ThemeToggle is a no-op.
  const bg = bgColor ?? null;
  const isLightBg = bg ? luminance(bg) > 0.5 : false;

  // Dark-mode palette: if the agency chose a light bg, derive a very dark
  // tinted version of it; if they chose dark, use it directly.
  const darkBg = !bg ? null : isLightBg ? darken(bg, 0.88) : bg;

  // Light-mode palette: if the agency chose a light bg, use it directly;
  // if they chose dark, derive a very light tinted version of it.
  const lightBg = !bg ? null : isLightBg ? bg : lighten(bg, 0.88);

  // CSS blocks for surfaces — only emitted when bg is set.
  // Manual overrides for card/border are applied to BOTH modes (the
  // agency picked one explicit colour and it should win regardless of
  // theme toggle).
  const overrides = { card: cardColor, border: borderColor };
  const darkSurfaces  = darkBg  ? buildSurfaces(darkBg,  overrides) : "";
  const lightSurfaces = lightBg ? buildSurfaces(lightBg, overrides) : "";

  // Text-color override is independent of bg luminance — when set, it
  // applies in both dark and light mode. Without an override, the
  // ThemeToggle/globals.css cascade controls --text and --text-dim.
  const textOverride = textColor
    ? `\n      --text: ${textColor};\n      --text-dim: ${hexToRgba(textColor, 0.6)};`
    : "";

  // Brand-color tokens are identical in both modes (the accent palette
  // doesn't change between dark/light — only the opacity dims slightly).
  const brandTokensDark = `
      --red: ${primary};
      --red-dim: ${hexToRgba(primary, 0.1)};
      --brand-secondary: ${secondary};
      --brand-secondary-dim: ${hexToRgba(secondary, 0.1)};
      --brand-accent: ${accent};
      --brand-accent-dim: ${hexToRgba(accent, 0.1)};
      --brand-highlight: ${highlight};
      --brand-highlight-dim: ${hexToRgba(highlight, 0.1)};
      --brand-pop: ${pop};
      --brand-pop-dim: ${hexToRgba(pop, 0.1)};`;

  const brandTokensLight = `
      --red: ${primary};
      --red-dim: ${hexToRgba(primary, 0.08)};
      --brand-secondary: ${secondary};
      --brand-secondary-dim: ${hexToRgba(secondary, 0.08)};
      --brand-accent: ${accent};
      --brand-accent-dim: ${hexToRgba(accent, 0.08)};
      --brand-highlight: ${highlight};
      --brand-highlight-dim: ${hexToRgba(highlight, 0.08)};
      --brand-pop: ${pop};
      --brand-pop-dim: ${hexToRgba(pop, 0.08)};`;

  const css = `
    :root {${brandTokensDark}${darkSurfaces}${textOverride}
    }
    html.light {${brandTokensLight}${lightSurfaces}${textOverride}
    }

    /* Scrollbar branding (dark mode) */
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
