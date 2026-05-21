"use client";

/**
 * Shared "Download PDF" trigger used by the sidebar and report viewer.
 *
 * Why this exists: previously both places rendered
 *   `<a href={pdfPath} download>Download PDF</a>`
 * which works fine on the happy path, but on the unhappy path the
 * browser silently saves whatever the route returns. When the
 * `/api/audit/[client]/pdf` route fell back to a JSON 500 error
 * response, the browser dutifully wrote `pdf.json` into Downloads with
 * the user's actual download history reading
 *   "pdf.json — file wasn't available"
 * — confusing, useless, and the original symptom of this bug.
 *
 * This component does the fetch itself, validates the Content-Type, and
 * either:
 *   - saves a Blob with a proper filename (PDF case), or
 *   - surfaces the server's error inline (text/html or anything else)
 * so the user never ends up with a mystery `pdf.json` file.
 *
 * Styling is passed through `className` so callers retain full control
 * over how the trigger looks (sidebar uses one style, the report viewer
 * uses another).
 */

import { useState, useCallback, type ReactNode } from "react";

interface Props {
  /** Server URL that returns `application/pdf`. */
  pdfPath: string;
  /** Filename hint used for the saved file (always suffixed `.pdf`). */
  filenameBase?: string;
  /** Trigger content (icon + label). */
  children: ReactNode;
  /** Idle styling — applied to the rendered <button>. */
  className?: string;
  /** Optional accessible label / tooltip. */
  title?: string;
}

export default function PdfDownloadLink({
  pdfPath,
  filenameBase = "audit-report",
  children,
  className,
  title,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(pdfPath, { cache: "no-store", credentials: "same-origin" });
      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok || !contentType.toLowerCase().includes("application/pdf")) {
        // Try to extract the human-readable bit from whatever the server
        // returned — JSON, HTML, or plain text — without crashing on parse
        // errors.
        let detail = "";
        try {
          const body = await res.text();
          if (contentType.includes("application/json")) {
            try {
              const parsed = JSON.parse(body) as { error?: string; detail?: string };
              detail = parsed.detail || parsed.error || body;
            } catch {
              detail = body;
            }
          } else if (contentType.includes("text/html")) {
            // Pull the <h1> or first <p> out of the HTML error page if we can.
            const h1 = /<h1[^>]*>([^<]+)<\/h1>/i.exec(body);
            const p = /<p[^>]*>([^<]+)<\/p>/i.exec(body);
            detail = (h1?.[1] || p?.[1] || body).trim();
          } else {
            detail = body;
          }
        } catch {
          /* noop — we'll fall back to the status line */
        }
        const summary = res.ok
          ? `Server returned ${contentType || "an unknown content type"} instead of a PDF.`
          : `PDF generation failed (HTTP ${res.status}).`;
        setError(detail ? `${summary} ${detail.slice(0, 240)}` : summary);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase}.pdf`;
      // Anchors created via JS need to be in the DOM to be clickable in
      // every browser (Firefox in particular). Append, click, remove.
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pdfPath, filenameBase]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        title={title}
        aria-busy={loading || undefined}
        style={{ cursor: loading ? "progress" : "pointer" }}
      >
        {loading ? "Generating PDF…" : children}
      </button>
      {error && (
        <div
          role="alert"
          className="mt-2 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.06)] px-3 py-2 font-mono text-[9px] leading-relaxed text-[var(--red)]"
        >
          {error}
        </div>
      )}
    </>
  );
}
