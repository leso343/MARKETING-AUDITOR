/**
 * Injects agency brand colors as CSS custom property overrides.
 *
 * Drop this inside any layout or page and the entire subtree automatically
 * picks up the agency palette through the existing `var(--red)` / `var(--red-dim)`
 * / `var(--accent)` references in all dashboard components.
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

export default function BrandTheme({ primaryColor, secondaryColor, accentColor }: BrandThemeProps) {
  // Only inject if at least one color is provided and differs from default
  if (!primaryColor) return null;

  const primary = primaryColor;
  const secondary = secondaryColor || primary;
  const accent = accentColor || primary;

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
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
