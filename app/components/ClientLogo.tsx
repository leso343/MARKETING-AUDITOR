"use client";

import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";

type Props = {
  name: string;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/**
 * ClientLogo — renders the correct logo variant based on the current theme.
 * Dark mode → logoUrl, Light mode → logoUrlLight (falls back to logoUrl).
 * Falls back to a Building2 icon when no logo is available.
 */
export default function ClientLogo({ name, logoUrl, logoUrlLight }: Props) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Check initial theme
    setIsLight(document.documentElement.classList.contains("light"));

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.classList.contains("light"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const activeLogo = isLight ? (logoUrlLight ?? logoUrl) : logoUrl;

  if (!activeLogo) {
    return <Building2 className="h-5 w-5 text-[var(--red)]" />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={activeLogo}
      alt={name}
      className="h-full w-full object-contain p-1"
    />
  );
}
