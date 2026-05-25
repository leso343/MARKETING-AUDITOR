"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Trash2,
  ImageIcon,
  Loader2,
  Globe,
  Sun,
  Moon,
  Check,
  AlertCircle,
} from "lucide-react";

type Props = {
  clientId: string;
  clientSlug: string;
  currentLogoUrl: string | null;
  currentLogoUrlLight: string | null;
  currentWebsiteUrl: string | null;
};

/**
 * Brand identity panel — logo (dark + light variants), website URL,
 * and an auto-fetch shortcut. The two prominent design elements:
 *
 *   1. A real segmented "Preview: Dark / Light" toggle below the logo
 *      so users can SEE how their logo looks on each background.
 *   2. Two clearly-labeled upload slots ("Dark-mode variant" /
 *      "Light-mode variant"), so it's never ambiguous that a click
 *      opens a file picker for that specific variant.
 */
export default function ClientLogoUpload({
  clientId,
  clientSlug,
  currentLogoUrl,
  currentLogoUrlLight,
  currentWebsiteUrl,
}: Props) {
  const router = useRouter();
  const darkFileRef = useRef<HTMLInputElement>(null);
  const lightFileRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const [logoUrlLight, setLogoUrlLight] = useState(currentLogoUrlLight);
  const [websiteUrl, setWebsiteUrl] = useState(currentWebsiteUrl ?? "");
  const [uploadingVariant, setUploadingVariant] = useState<"dark" | "light" | null>(null);
  const [removingVariant, setRemovingVariant] = useState<"dark" | "light" | "all" | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"dark" | "light">("dark");

  // Upload a logo file for the given variant slot.
  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    variant: "dark" | "light",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Aligned with /api/upload-logo: png/jpg/webp/svg. The validation
    // here matches the file-picker accept list — the previous version
    // accepted SVG in the picker but rejected it here, which surfaced
    // a confusing "Use PNG, JPG, or WEBP" error after the user picked.
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setError("Use PNG, JPG, WEBP, or SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2 MB.");
      return;
    }

    setUploadingVariant(variant);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", "client");
      formData.append("clientSlug", clientSlug);
      formData.append("variant", variant);

      const uploadRes = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const j = await uploadRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Upload failed (${uploadRes.status})`);
      }

      const { url } = await uploadRes.json();
      if (variant === "dark") setLogoUrl(url);
      else setLogoUrlLight(url);

      // Flip preview to the variant they just uploaded so they see it.
      setPreviewMode(variant);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingVariant(null);
      if (darkFileRef.current) darkFileRef.current.value = "";
      if (lightFileRef.current) lightFileRef.current.value = "";
    }
  };

  // Auto-fetch logo from client's website (uses /api/fetch-logo).
  const handleFetchFromUrl = async () => {
    const url = websiteUrl.trim();
    if (!url) {
      setError("Enter a website URL first.");
      return;
    }
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, clientSlug, clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setLogoUrl(data.logoUrl);
      setLogoUrlLight(data.logoUrlLight);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  // Remove a single variant or both.
  const removeLogo = async (variant: "dark" | "light" | "all") => {
    setRemovingVariant(variant);
    setError(null);
    try {
      const payload: Record<string, string | null> = { clientId };
      if (variant === "dark" || variant === "all") payload.logoUrl = null;
      if (variant === "light" || variant === "all") payload.logoUrlLight = null;
      await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (variant === "dark" || variant === "all") setLogoUrl(null);
      if (variant === "light" || variant === "all") setLogoUrlLight(null);
      router.refresh();
    } catch {
      setError("Failed to remove logo");
    } finally {
      setRemovingVariant(null);
    }
  };

  // Which logo to show in the preview frame. Fall back to whichever
  // variant exists so a single-variant logo still previews.
  const activeLogo = previewMode === "light" ? (logoUrlLight ?? logoUrl) : (logoUrl ?? logoUrlLight);
  const hasAnyLogo = Boolean(logoUrl || logoUrlLight);

  return (
    <div className="space-y-5">
      {/* ── Preview frame + Dark/Light segmented toggle ─────────────── */}
      <div className="flex flex-col items-center gap-3">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-lg border overflow-hidden transition-colors duration-200 ${
            previewMode === "dark"
              ? "border-[#151515] bg-[#030303]"
              : "border-[#c9cdd4] bg-[#ffffff]"
          }`}
        >
          {activeLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={activeLogo} alt="Client logo" className="h-full w-full object-contain p-2.5" />
          ) : (
            <ImageIcon
              className={`h-8 w-8 ${previewMode === "dark" ? "text-[#5a5a5a]" : "text-[#94a3b8]"}`}
            />
          )}
        </div>

        {/* Real segmented Dark / Light preview toggle */}
        <div
          role="group"
          aria-label="Preview background"
          className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg)] p-0.5"
        >
          <button
            type="button"
            onClick={() => setPreviewMode("dark")}
            aria-pressed={previewMode === "dark"}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-all ${
              previewMode === "dark"
                ? "bg-[var(--card)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            <Moon className="h-3 w-3" /> Dark
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode("light")}
            aria-pressed={previewMode === "light"}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-all ${
              previewMode === "light"
                ? "bg-[var(--card)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            <Sun className="h-3 w-3" /> Light
          </button>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] text-center">
          Preview only — switches which logo variant you&apos;re viewing
        </p>
      </div>

      {/* ── Two clearly-labeled upload slots ─────────────────────────── */}
      <div className="space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
          Logo files
        </div>

        {/* Dark variant slot */}
        <LogoSlot
          icon={<Moon className="h-3.5 w-3.5" />}
          label="Dark-mode logo"
          hint="Shown on dark backgrounds"
          uploaded={Boolean(logoUrl)}
          uploading={uploadingVariant === "dark"}
          removing={removingVariant === "dark" || removingVariant === "all"}
          onUploadClick={() => darkFileRef.current?.click()}
          onRemoveClick={() => removeLogo("dark")}
        />
        <input
          ref={darkFileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={(e) => handleUpload(e, "dark")}
          disabled={uploadingVariant !== null || fetching}
          className="hidden"
        />

        {/* Light variant slot */}
        <LogoSlot
          icon={<Sun className="h-3.5 w-3.5" />}
          label="Light-mode logo"
          hint="Shown on light backgrounds & PDFs"
          uploaded={Boolean(logoUrlLight)}
          uploading={uploadingVariant === "light"}
          removing={removingVariant === "light" || removingVariant === "all"}
          onUploadClick={() => lightFileRef.current?.click()}
          onRemoveClick={() => removeLogo("light")}
        />
        <input
          ref={lightFileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={(e) => handleUpload(e, "light")}
          disabled={uploadingVariant !== null || fetching}
          className="hidden"
        />

        {hasAnyLogo && (
          <button
            type="button"
            onClick={() => removeLogo("all")}
            disabled={uploadingVariant !== null || removingVariant !== null || fetching}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-50"
          >
            {removingVariant === "all" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove both
          </button>
        )}
      </div>

      {/* ── Website + auto-fetch ──────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
          Auto-fetch from website
        </div>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://clientwebsite.com"
            className="w-full bg-[var(--bg)] border border-[var(--border)] pl-9 pr-3 py-2 text-xs font-mono focus:border-[var(--red)] outline-none rounded"
          />
        </div>
        <button
          type="button"
          onClick={handleFetchFromUrl}
          disabled={fetching || uploadingVariant !== null || !websiteUrl.trim()}
          className="w-full flex items-center justify-center gap-1.5 rounded border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
          {fetching ? "Fetching…" : "Fetch logo from URL"}
        </button>
      </div>

      {/* ── Error surface ─────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded bg-[var(--red)]/10 border border-[var(--red)]/20 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--red)] mt-0.5" />
          <p className="text-[11px] font-mono text-[var(--red)]">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ── Subcomponent: a single logo-variant slot ────────────────────────── */
function LogoSlot({
  icon,
  label,
  hint,
  uploaded,
  uploading,
  removing,
  onUploadClick,
  onRemoveClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  uploaded: boolean;
  uploading: boolean;
  removing: boolean;
  onUploadClick: () => void;
  onRemoveClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded border px-3 py-2.5 transition-colors ${
        uploaded
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-[var(--border)] bg-[var(--bg)]"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          uploaded ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--card)] text-[var(--text-dim)]"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{label}</span>
          {uploaded ? (
            <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-emerald-400">
              <Check className="h-2.5 w-2.5" /> Uploaded
            </span>
          ) : (
            <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)]">
              Not set
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{hint}</div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading || removing}
          className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-50"
          title={uploaded ? "Replace this logo" : "Upload this logo"}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploaded ? "Replace" : "Upload"}
        </button>
        {uploaded && (
          <button
            type="button"
            onClick={onRemoveClick}
            disabled={uploading || removing}
            className="flex items-center justify-center rounded border border-[var(--border)] p-1.5 text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-50"
            title="Remove this logo"
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
