"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  FileSpreadsheet,
  X,
  Sparkles,
} from "lucide-react";

type Step = 1 | 2 | 3;

/**
 * OnboardingWizard — a 3-step guided flow for new users:
 *   1. Create a client (name + slug)
 *   2. Upload Meta Ads CSVs
 *   3. Success — link to audit dashboard
 *
 * Displayed on the home page when the user has zero clients.
 * Dismissible via the X button (persisted in localStorage).
 */
export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bpa-onboarding-dismissed") === "1";
  });

  // Step 1: create client
  const [clientName, setClientName] = useState("");
  const [clientSlug, setClientSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdClientSlug, setCreatedClientSlug] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  // Step 2: upload CSVs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const autoSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

  const handleNameChange = (name: string) => {
    setClientName(name);
    if (!slugTouched) {
      setClientSlug(autoSlug(name));
    }
  };

  const handleCreateClient = async () => {
    if (!clientName.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clientName.trim(),
          slug: clientSlug || autoSlug(clientName),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error ?? `Failed (${res.status})`);
        return;
      }

      const data = await res.json();
      setCreatedClientSlug(data.slug ?? clientSlug);
      setCreatedClientId(data.id ?? null);
      setStep(2);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter(
      (f) => f.name.endsWith(".csv") || f.type === "text/csv",
    );
    setFiles((prev) => [...prev, ...selected]);
    // Reset input so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = useCallback(async () => {
    if (!createdClientSlug || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadedCount(0);

    let done = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const res = await fetch(`/api/clients/${createdClientSlug}/csvs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content: text }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Upload failed (${res.status})`);
        }
        done++;
        setUploadedCount(done);
        setUploadProgress(Math.round((done / files.length) * 100));
      } catch (err) {
        setUploadError(
          `Failed uploading ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    setStep(3);
  }, [createdClientSlug, files]);

  const dismiss = () => {
    localStorage.setItem("bpa-onboarding-dismissed", "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="panel relative overflow-hidden mb-8">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors z-10"
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-6">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`
                flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold
                transition-all duration-300
                ${step > s
                  ? "bg-emerald-500/20 text-emerald-400"
                  : step === s
                  ? "bg-[var(--red)]/15 text-[var(--red)]"
                  : "bg-[var(--border)] text-[var(--text-dim)]"
                }
              `}
            >
              {step > s ? <Check className="h-3 w-3" /> : s}
            </div>
            <span
              className={`font-mono text-[9px] uppercase tracking-widest hidden sm:inline
                ${step === s ? "text-[var(--text)]" : "text-[var(--text-dim)]"}
              `}
            >
              {s === 1 ? "Create client" : s === 2 ? "Upload CSVs" : "Done"}
            </span>
            {s < 3 && (
              <div className={`flex-1 h-px transition-colors duration-300 ${step > s ? "bg-emerald-500/30" : "bg-[var(--border)]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Create Client */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--bg)]">
              <Building2 className="h-5 w-5 text-[var(--red)]" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-head)" }}>
                Welcome! Let's set up your first audit.
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Start by naming the business you're auditing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Acme Roofing"
                className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
                URL Slug
              </label>
              <input
                type="text"
                value={clientSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setClientSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                placeholder="acme-roofing"
                className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
              />
            </div>
          </div>

          {createError && (
            <p className="text-xs text-[var(--red)] font-mono">{createError}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleCreateClient}
              disabled={creating || !clientName.trim()}
              className="flex items-center gap-2 bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-5 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? "Creating…" : "Create & Continue"}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Upload CSVs */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--bg)]">
              <Upload className="h-5 w-5 text-[var(--red)]" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-head)" }}>
                Upload Meta Ads CSVs
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Export CSVs from Meta Ads Manager and upload them here.
              </p>
            </div>
          </div>

          {/* Drop zone */}
          <label
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border)] rounded px-6 py-8 cursor-pointer transition-colors hover:border-[var(--red)]/50 hover:bg-[var(--red)]/[0.02]"
          >
            <FileSpreadsheet className="h-8 w-8 text-[var(--text-dim)]" />
            <span className="text-sm text-[var(--text-dim)]">
              Click to select CSV files
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
              .csv files only
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--red)] flex-shrink-0" />
                    <span className="truncate font-mono">{f.name}</span>
                    <span className="text-[var(--text-dim)] flex-shrink-0">
                      ({(f.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors flex-shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--red)] transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest text-center">
                Uploading {uploadedCount} / {files.length}
              </p>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-[var(--red)] font-mono">{uploadError}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                }}
                className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="flex items-center gap-2 bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-5 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {uploading ? "Uploading…" : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="text-center py-4 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <Sparkles className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
              You're all set!
            </h3>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              {uploadedCount > 0
                ? `${uploadedCount} CSV${uploadedCount !== 1 ? "s" : ""} uploaded. Your forensic audit is ready.`
                : "Your client has been created. Upload CSVs anytime to run an audit."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {createdClientSlug && (
              <button
                type="button"
                onClick={() => {
                  dismiss();
                  router.push(`/audit/${createdClientSlug}`);
                }}
                className="flex items-center gap-2 bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-5 py-2.5 hover:opacity-90 transition-opacity"
              >
                View Audit
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                dismiss();
                router.refresh();
              }}
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
