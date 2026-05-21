"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCsvButton({ slug, filename }: { slug: string; filename: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const onClick = () => {
    if (!confirm(`Delete ${filename}?`)) return;
    startTransition(async () => {
      await fetch(`/api/clients/${slug}/csvs?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
      router.refresh();
    });
  };
  return (
    <button type="button" onClick={onClick} disabled={pending}
      className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--red)] disabled:opacity-50">
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
