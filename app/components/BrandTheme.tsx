/**
 * Injects agency brand colors as CSS custom property overrides.
 *
 * Five brand slots:
 *   --red / --red-dim          ← Primary (buttons, headlines, main brand)
 *   --brand-secondary(-dim)    ← Secondary (charts, links)
 *   --brand-accent(-dim)       ← Accent (borders, cards, hover)
 *   --brand-highlight(-dim)    ← Highlight (alerts, rank badges, callouts)
 *   --brand-pop(-dim)          ← Pop (sparklines, decorations, chart accents)
 *
 * Also overrides scrollbar gradient + slider thumbs to match.
 *
 * When no colors are provided (legacy / filesystem mode), nothing is injected
 * and the default globals.css values remain in effect.
 */

interface BrandThemeProps {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  highlightColor?: string | null;
  popColor?: string | null;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function BrandTheme({
  primaryColor,
  secondaryColor,
  accentColor,
  highlightColor,
  popColor,
}: BrandThemeProps) {
  if (!primaryColor) return null;

  const primary = primaryColor;
  const secondary = secondaryColor || primary;
  const accent = accentColor || primary;
  const highlight = highlightColor || "#ff6b35";
  const pop = popColor || "#ffd700";

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
      --brand-highlight: ${highlight};
      --brand-highlight-dim: ${hexToRgba(highlight, 0.1)};
      --brand-pop: ${pop};
      --brand-pop-dim: ${hexToRgba(pop, 0.1)};
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
      --brand-pop-dim: ${hexToRgba(pop, 0.08)};
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
