"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  KeyRound,
  Loader2,
  Check,
  Trash2,
  AlertCircle,
  ExternalLink,
  Lock,
} from "lucide-react";

interface KeyStatus {
  configured: boolean;
  keyMask?: string;
  validated?: boolean;
  lastValidatedAt?: number | null;
}

/**
 * Settings UI for BYO Anthropic key (Agency tier only).
 *
 * - On mount, fetches current key status (masked).
 * - User can paste a new key; we POST to validate + encrypt + store.
 * - User can revoke; we DELETE and fall back to server key.
 *
 * Plaintext key never leaves the client → server boundary, and never
 * comes back from the server (only the mask).
 */
export default function AiKeyForm({ planId }: { planId: "free" | "pro" | "agency" }) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/ai/byo-key");
      if (res.ok) {
        const data = (await res.json()) as KeyStatus;
        setStatus(data);
      } else {
        setStatus({ configured: false });
      }
    } catch {
      setStatus({ configured: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (planId === "agency") refresh();
    else setLoading(false);
  }, [planId]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/ai/byo-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setStatus(data);
      setKeyInput("");
      setShowInput(false);
      setSuccess("Key saved and validated. AI assistant now uses your Anthropic account.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    if (!confirm("Remove your Anthropic key? AI assistant will fall back to the included plan limits.")) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/byo-key", { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setStatus({ configured: false });
      setSuccess("Key removed. AI assistant now uses the included plan.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  // ── Free / Pro: locked behind upgrade ──────────────────────────────────
  if (planId !== "agency") {
    return (
      <div className="panel">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)]">
            <Lock className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Bring your own Anthropic key</div>
            <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">
              Agency-tier feature. Connect your own Anthropic API key for unlimited AI
              assistant usage, billed directly to your Anthropic account.
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-1 mt-3 text-xs font-mono uppercase tracking-widest text-[var(--red)] hover:underline"
            >
              Upgrade to Agency →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel flex items-center gap-2 text-xs text-[var(--text-dim)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading key status…
      </div>
    );
  }

  return (
    <div className="panel space-y-4">
      {/* Status row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              status?.configured
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-[var(--border)] bg-[var(--bg)]"
            }`}
          >
            {status?.configured ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <KeyRound className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {status?.configured ? "Your key is active" : "No key configured"}
              </span>
              {status?.configured && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                  Unlimited
                </span>
              )}
            </div>
            {status?.configured ? (
              <div className="text-xs text-[var(--text-dim)] mt-0.5 font-mono">
                {status.keyMask} ·{" "}
                {status.lastValidatedAt
                  ? `validated ${new Date(status.lastValidatedAt).toLocaleString()}`
                  : "not validated"}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-dim)] mt-0.5">
                Using included plan limits (100 messages/day fair-use)
              </div>
            )}
          </div>
        </div>
        {status?.configured && !removing && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]"
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </button>
        )}
      </div>

      {/* Toggle to show input */}
      {!showInput && (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)]/40 hover:text-[var(--red)] hover:bg-[var(--red)]/[0.03]"
        >
          <Sparkles className="h-3 w-3" />
          {status?.configured ? "Replace key" : "Add Anthropic key"}
        </button>
      )}

      {/* Input form */}
      {showInput && (
        <form onSubmit={onSave} className="space-y-2">
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
              Anthropic API key
            </span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-api03-…"
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-xs font-mono focus:border-[var(--red)] outline-none"
              disabled={saving}
              required
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !keyInput.trim()}
              className="flex items-center gap-1.5 rounded bg-[var(--red)] px-3 py-1.5 text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Validating…
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" /> Validate & save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setKeyInput("");
                setError(null);
              }}
              disabled={saving}
              className="rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-50"
            >
              Cancel
            </button>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              Get key <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </form>
      )}

      {/* Error / success surfaces */}
      {error && (
        <div className="flex items-start gap-2 rounded bg-[var(--red)]/10 border border-[var(--red)]/20 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--red)] mt-0.5" />
          <p className="text-[11px] font-mono text-[var(--red)]">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
          <p className="text-[11px] font-mono text-emerald-400">{success}</p>
        </div>
      )}

      {/* Footnote */}
      <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] leading-relaxed">
        Encrypted at rest (AES-256-GCM). Validated against Anthropic on save. Never shown back in full —
        only the last 4 chars. You pay Anthropic directly when active.
      </p>
    </div>
  );
}
