"use client";
import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileUp, CheckCircle2, XCircle } from "lucide-react";

export default function UploadCsvForm({ slug }: { slug: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setInfo(null);
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("file", f);

      startTransition(async () => {
        const res = await fetch(`/api/clients/${slug}/csvs`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? `Upload failed (${res.status})`);
          return;
        }
        const j = (await res.json()) as {
          results: { filename: string; status: string; error?: string }[];
        };
        const ok = j.results.filter((r) => r.status === "saved").length;
        const fail = j.results.length - ok;
        setInfo(
          `${ok} file${ok !== 1 ? "s" : ""} uploaded${fail ? ` · ${fail} failed` : ""}`,
        );
        router.refresh();
      });
    },
    [slug, router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      upload(e.dataTransfer.files);
    },
    [upload],
  );

  return (
    <div className="panel">
      <div className="panel-label mb-3">
        <Upload className="h-3.5 w-3.5 text-[var(--red)]" />
        Upload CSV exports
      </div>

      {/* drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all ${
          dragOver
            ? "border-[var(--red)] bg-[var(--red)]/5"
            : "border-[var(--border)] hover:border-[var(--text-dim)] hover:bg-[var(--text)]/[0.02]"
        } ${pending ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={(e) => upload(e.target.files)}
          disabled={pending}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
              dragOver
                ? "border-[var(--red)] bg-[var(--red)]/10"
                : "border-[var(--border)] bg-[var(--card)]"
            }`}
          >
            <FileUp
              className={`h-5 w-5 transition-colors ${
                dragOver ? "text-[var(--red)]" : "text-[var(--text-dim)]"
              }`}
            />
          </div>
          <div>
            <span className="text-sm font-medium">
              {pending ? "Uploading…" : "Drop CSV files here"}
            </span>
            <span className="text-sm text-[var(--text-dim)]"> or </span>
            <span className="text-sm font-medium text-[var(--red)]">browse</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Accepts .csv · re-uploading replaces previous version
          </div>
        </div>
      </div>

      {/* status */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded bg-red-500/10 px-3 py-2">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="text-xs font-mono text-red-400">{error}</span>
        </div>
      )}
      {info && (
        <div className="mt-3 flex items-center gap-2 rounded bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">{info}</span>
        </div>
      )}
    </div>
  );
}
