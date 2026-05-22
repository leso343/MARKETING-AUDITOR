"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteCsvButton({ slug, filename }: { slug: string; filename: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Delete ${filename}?`)) return;
    startTransition(async () => {
      await fetch(
        `/api/clients/${slug}/csvs?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex items-center gap-1.5 rounded border border-transparent px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="h-3 w-3" />
      )}
      {pending ? "Deleting" : "Delete"}
    </button>
  );
}
