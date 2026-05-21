"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Printer, ChevronLeft, Download } from "lucide-react";
import { useLang } from "@/context/LangContext";

interface Props {
  open: boolean;
  page: number;
  onClose: () => void;
  pdfPath?: string;
}

const PAGE_TABS = [
  { label: "Diagnostic", page: 1 },
  { label: "Creative & Age", page: 2 },
  { label: "30-Day Roadmap", page: 3 },
  { label: "Geo Audit", page: 4 },
];

export default function ReportViewer({ open, page, onClose, pdfPath }: Props) {
  const { t } = useLang();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activePage, setActivePage] = useState(page);

  // Sync activePage when page prop changes externally
  useEffect(() => {
    if (open) setActivePage(page);
  }, [page, open]);

  // Lock/unlock background scroll
  useEffect(() => {
    if (open) {
      document.documentElement.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
    }
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  // Animate in/out
  useEffect(() => {
    if (open) {
      // Slight delay to allow DOM to mount before starting animation
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setLoaded(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Scroll iframe to page anchor
  const scrollToPage = useCallback((p: number) => {
    setActivePage(p);
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      const el = doc.getElementById(`page${p}`);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } catch {
      // Cross-origin fallback (shouldn't happen for same-origin)
    }
  }, []);

  // Scroll to page after iframe loads
  useEffect(() => {
    if (loaded && open) {
      scrollToPage(activePage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Don't render at all when closed (after animation ends)
  if (!open && !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "#030303",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
      aria-modal="true"
      role="dialog"
    >
      {/* Top nav bar */}
      <nav
        className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-2 py-2 sm:px-4"
        style={{ background: "rgba(6,6,6,0.98)", backdropFilter: "blur(8px)", scrollbarWidth: "none" }}
      >
        {/* Back button */}
        <button
          onClick={onClose}
          className="flex shrink-0 items-center gap-1.5 border border-[var(--border)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-white sm:px-3"
        >
          <ChevronLeft className="h-3 w-3" />
          <span className="hidden sm:inline">{t("← Back to Dashboard", "← Back to Dashboard")}</span>
          <span className="sm:hidden">Back</span>
        </button>

        <div className="mx-1 h-4 w-px shrink-0 bg-[var(--border)] sm:mx-2" />

        {/* Page tabs */}
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.page}
            onClick={() => scrollToPage(tab.page)}
            className="shrink-0 border px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors sm:px-3"
            style={{
              borderColor: activePage === tab.page ? "var(--red)" : "var(--border)",
              color: activePage === tab.page ? "var(--red)" : "var(--text-dim)",
              background:
                activePage === tab.page ? "rgba(255,0,0,0.07)" : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Print */}
          <button
            onClick={() => {
              try {
                iframeRef.current?.contentWindow?.print();
              } catch {
                window.print();
              }
            }}
            className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-white sm:px-3"
            title="Print Report"
          >
            <Printer className="h-3 w-3" />
            <span className="hidden sm:inline">{t("Print", "Print")}</span>
          </button>

          {/* PDF download — only shown when a real PDF exists for this client */}
          {pdfPath && (
            <a
              href={pdfPath}
              download
              className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-white sm:px-3"
              title="Download PDF"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">{t("PDF", "PDF")}</span>
            </a>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] transition-colors hover:bg-[rgba(255,0,0,0.12)] sm:px-3"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </nav>

      {/* Iframe fills remaining height */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading spinner */}
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#030303]">
            <div
              className="h-8 w-8 rounded-full border-2 border-[var(--border)] border-t-[var(--red)]"
              style={{ animation: "spin 0.8s linear infinite" }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/campaign_report.html"
          title="Campaign Report"
          className="h-full w-full border-none"
          onLoad={() => setLoaded(true)}
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}
