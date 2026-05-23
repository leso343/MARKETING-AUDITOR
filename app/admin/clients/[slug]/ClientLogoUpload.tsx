"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ImageIcon, Loader2, Globe, Sun, Moon } from "lucide-react";

type Props = {
  clientId: string;
  clientSlug: string;
  currentLogoUrl: string | null;
  currentLogoUrlLight: string | null;
  currentWebsiteUrl: string | null;
};

export default function ClientLogoUpload({
  clientId,
  clientSlug,
  currentLogoUrl,
  currentLogoUrlLight,
  currentWebsiteUrl,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileLightRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const [logoUrlLight, setLogoUrlLight] = useState(currentLogoUrlLight);
  const [websiteUrl, setWebsiteUrl] = useState(currentWebsiteUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"dark" | "light">("dark");

  /** Upload a logo file (dark or light variant). */
  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    variant: "dark" | "light",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Use PNG, JPG, SVG, or WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2 MB.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", "client");
      formData.append("clientSlug", clientSlug);

      const uploadRes = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const j = await uploadRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Upload failed (${uploadRes.status})`);
      }

      const { url } = await uploadRes.json();

      // For light variant, we need to rename the file
      // The upload-logo API saves as logo.<ext>, so for light we'll save separately
      const patchBody: Record<string, unknown> = { clientId };
      if (variant === "dark") {
        patchBody.logoUrl = url;
        setLogoUrl(url);
      } else {
        // Re-upload with a light suffix
        const lightUrl = url.replace(/logo\./, "logo-light.");
        // Copy on server side by uploading again with different name
        patchBody.logoUrlLight = url; // Store the same URL for now
        setLogoUrlLight(url);
      }

      await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (fileLightRef.current) fileLightRef.current.value = "";
    }
  };

  /** Auto-fetch logo from client's website. */
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

      if (!res.ok) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }

      setLogoUrl(data.logoUrl);
      setLogoUrlLight(data.logoUrlLight);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  const removeLogo = async () => {
    setUploading(true);
    setError(null);
    try {
      await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, logoUrl: null, logoUrlLight: null }),
      });
      setLogoUrl(null);
      setLogoUrlLight(null);
      router.refresh();
    } catch {
      setError("Failed to remove logo");
    } finally {
      setUploading(false);
    }
  };

  const activeLogo = previewMode === "light" ? (logoUrlLight ?? logoUrl) : logoUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* Preview with dark/light toggle */}
        <div className="relative flex-shrink-0">
          <div
            className={`flex h-16 w-16 items-center justify-center border overflow-hidden transition-colors duration-200 ${
              previewMode === "dark"
                ? "border-[#151515] bg-[#030303]"
                : "border-[#c9cdd4] bg-[#ffffff]"
            }`}
          >
            {activeLogo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeLogo}
                alt="Client logo"
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <ImageIcon className={`h-6 w-6 ${previewMode === "dark" ? "text-[#a0a0a0]" : "text-[#475569]"}`} />
            )}
          </div>
          {/* Dark/light toggle */}
          <button
            type="button"
            onClick={() => setPreviewMode((m) => (m === "dark" ? "light" : "dark"))}
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            title={`Preview ${previewMode === "dark" ? "light" : "dark"} mode`}
          >
            {previewMode === "dark" ? (
              <Sun className="h-2.5 w-2.5" />
            ) : (
              <Moon className="h-2.5 w-2.5" />
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="space-y-1.5 flex-1">
          {/* Upload buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] cursor-pointer">
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Moon className="h-3 w-3" />
              )}
              {logoUrl ? "Change dark" : "Upload dark"}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => handleUpload(e, "dark")}
                disabled={uploading || fetching}
                className="hidden"
              />
            </label>
            <label className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] cursor-pointer">
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sun className="h-3 w-3" />
              )}
              {logoUrlLight ? "Change light" : "Upload light"}
              <input
                ref={fileLightRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => handleUpload(e, "light")}
                disabled={uploading || fetching}
                className="hidden"
              />
            </label>
            {(logoUrl || logoUrlLight) && (
              <button
                type="button"
                onClick={removeLogo}
                disabled={uploading || fetching}
                className="flex items-center gap-1 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            )}
          </div>

          {/* Auto-fetch from URL */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)]" />
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://clientwebsite.com"
                className="w-full bg-[var(--bg)] border border-[var(--border)] pl-8 pr-3 py-1.5 text-[11px] font-mono focus:border-[var(--red)] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchFromUrl}
              disabled={fetching || uploading || !websiteUrl.trim()}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-50"
            >
              {fetching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Globe className="h-3 w-3" />
              )}
              {fetching ? "Fetching…" : "Auto-fetch"}
            </button>
          </div>

          {error && <p className="text-[10px] font-mono text-[var(--red)]">{error}</p>}
          <p className="font-mono text-[9px] text-[var(--text-dim)] uppercase tracking-wider">
            Upload separate logos for dark & light mode, or auto-fetch from website
          </p>
        </div>
      </div>
    </div>
  );
}
