/**
 * Injects agency brand colors as CSS custom property overrides.
 *
 * Drop this inside any layout or page and the entire subtree automatically
 * picks up the agency palette through the existing `var(--red)` / `var(--red-dim)`
 * references in all dashboard components, plus `var(--brand-secondary)` and
 * `var(--brand-accent)` for charts, status indicators, and decorative elements.
 *
 * Also overrides the scrollbar gradient to match the brand palette — the
 * scrollbar is one of the first things a client sees and leaving it stock red
 * while everything else is rebranded looks jarring.
 *
 * When no colors are provided (legacy / filesystem mode), nothing is injected
 * and the default globals.css values remain in effect.
 */

interface BrandThemeProps {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex color by a fraction (0–1). */
function darken(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Lighten a hex color by a fraction (0–1). */
function lighten(hex: string, amount: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function BrandTheme({ primaryColor, secondaryColor, accentColor }: BrandThemeProps) {
  if (!primaryColor) return null;

  const primary = primaryColor;
  const secondary = secondaryColor || primary;
  const accent = accentColor || primary;

  const primaryDark = darken(primary, 0.5);
  const primaryLight = lighten(primary, 0.2);

  const css = `
    :root {
      --red: ${primary};
      --red-dim: ${hexToRgba(primary, 0.1)};
      --brand-secondary: ${secondary};
      --brand-secondary-dim: ${hexToRgba(secondary, 0.1)};
      --brand-accent: ${accent};
      --brand-accent-dim: ${hexToRgba(accent, 0.1)};
    }
    html.light {
      --red: ${primary};
      --red-dim: ${hexToRgba(primary, 0.08)};
      --brand-secondary: ${secondary};
      --brand-secondary-dim: ${hexToRgba(secondary, 0.08)};
      --brand-accent: ${accent};
      --brand-accent-dim: ${hexToRgba(accent, 0.08)};
    }

    /* ── scrollbar branding ── */
    * { scrollbar-color: ${primary} #040404; }
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

    /* ── slider thumbs ── */
    .range-input::-webkit-slider-thumb {
      background: ${primary} !important;
      box-shadow: 0 0 8px ${hexToRgba(primary, 0.5)} !important;
    }
    .range-input::-moz-range-thumb {
      background: ${primary} !important;
    }

    /* ── status colors ── */
    .status-critical { color: ${primary} !important; }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
