"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface ExportGuideProps {
  guide: {
    title: string;
    steps: string[];
    metaLink: string;
  };
  isUploaded: boolean;
}

export default function ExportGuide({ guide, isUploaded }: ExportGuideProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySteps = () => {
    const text = guide.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all ${
          isUploaded
            ? "text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--text)]/[0.05]"
            : "text-[var(--red)] hover:bg-[var(--red)]/10"
        }`}
      >
        {open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        How to export
      </button>

      {open && (
        <div className="mt-2 ml-7 rounded border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <h4
              className="font-semibold text-sm"
              style={{ fontFamily: "var(--font-head)" }}
            >
              {guide.title}
            </h4>
            <button
              onClick={copySteps}
              className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--text)]/[0.05] transition-colors"
              title="Copy steps"
            >
              {copied ? (
                <>
                  <Check className="h-2.5 w-2.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-2.5 w-2.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          <ol className="space-y-2 text-xs text-[var(--text-dim)] list-none">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--red)]/10 text-[var(--red)] font-mono text-[9px] font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          <div className="pt-1 border-t border-[var(--border)]">
            <a
              href={guide.metaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded px-3 py-2 bg-[var(--red)]/10 text-[var(--red)] font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--red)]/20 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open in Meta Ads Manager
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
