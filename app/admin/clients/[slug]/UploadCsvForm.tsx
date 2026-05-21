"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

export default function UploadCsvForm({ slug }: { slug: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setInfo(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);

    startTransition(async () => {
      const res = await fetch(`/api/clients/${slug}/csvs`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Upload failed (${res.status})`);
        return;
      }
      const j = (await res.json()) as { results: { filename: string; status: string; error?: string }[] };
      const ok = j.results.filter((r) => r.status === "saved").length;
      const fail = j.results.length - ok;
      setInfo(`${ok} uploaded${fail ? `, ${fail} failed` : ""}.`);
      router.refresh();
    });
  };

  return (
    <div className="panel">
      <div className="panel-label mb-3">Upload CSV exports</div>
      <p className="text-xs text-[var(--text-dim)] mb-3">
        Drop the five Meta Ads CSVs here (or pick them with the file picker). Re-uploading a file with the same name replaces the previous version.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={(e) => upload(e.target.files)}
        disabled={pending}
        className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:bg-[var(--red)] file:text-white file:border-0 file:font-mono file:text-xs file:uppercase file:tracking-widest file:cursor-pointer text-[var(--text-dim)]"
      />
      {pending && <div className="mt-3 text-xs font-mono text-[var(--text-dim)]">Uploading…</div>}
      {error && <div className="mt-3 text-xs font-mono text-[var(--red)]">{error}</div>}
      {info && <div className="mt-3 text-xs font-mono text-emerald-400">{info}</div>}
    </div>
  );
}
