"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  Eye,
  EyeOff,
  ChevronLeft,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type UploadState = "idle" | "dragging" | "uploading" | "done" | "error";
type SaveState   = "idle" | "saving" | "saved" | "error";
type TestState   = "idle" | "testing" | "connected" | "failed";

/* ─────────────────────────────────────────────
   Dropzone component
───────────────────────────────────────────── */
function LogoDropzone({
  label,
  hint,
  target,
  clientSlug,
  currentUrl,
  previewHeight,
}: {
  label: string;
  hint: string;
  target: "agency" | "client";
  clientSlug?: string;
  currentUrl?: string | null;
  previewHeight: string;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setState("uploading");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("target", target);
    if (clientSlug) fd.append("clientSlug", clientSlug);

    try {
      const res = await fetch("/api/upload-logo", { method: "POST", body: fd });
      const data = await res.json() as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Upload failed");
        setState("error");
        return;
      }
      // Use a cache-busted URL so the browser re-fetches the new logo
      setPreviewUrl(`${data.url}?t=${Date.now()}`);
      setState("done");
    } catch {
      setError("Network error during upload");
      setState("error");
    }
  }, [target, clientSlug]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState("idle");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setState("dragging"); };
  const onDragLeave = () => { if (state === "dragging") setState("idle"); };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const isDragging = state === "dragging";
  const isUploading = state === "uploading";

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-[var(--text-dim)] font-mono">
        {label}
      </div>
      <div className="text-[11px] text-[var(--text-dim)]">{hint}</div>

      {previewUrl && state !== "error" ? (
        /* ── preview at actual sidebar size ── */
        <div className="space-y-2">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] opacity-60">
            Preview — actual dashboard size
          </div>
          <div
            className="flex items-center gap-5 rounded border border-[var(--border)] p-5"
            style={{ background: "var(--sidebar)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Logo preview"
              className={`${previewHeight} w-auto max-w-[210px] object-contain`}
            />
            <div className="flex flex-col gap-2 border-l border-[var(--border)] pl-5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#4ade80] uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3" />
                Logo set
              </div>
              <button
                type="button"
                onClick={() => { setPreviewUrl(null); setState("idle"); }}
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--red)] transition-colors"
              >
                × Replace
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── dropzone ── */
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={[
            "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded border-2 border-dashed p-8 text-center transition-all duration-200",
            isDragging
              ? "border-[var(--red)] bg-[var(--red-dim)] animate-pulse"
              : "border-[var(--border)] hover:border-[var(--red)] hover:bg-[rgba(255,0,0,0.04)]",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            className="hidden"
            onChange={onInputChange}
          />

          {isUploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-[var(--red)]" />
          ) : (
            <Upload className={`h-7 w-7 ${isDragging ? "text-[var(--red)]" : "text-[var(--text-dim)]"}`} />
          )}

          <div className="font-mono text-[11px] text-[var(--text-dim)]">
            {isUploading
              ? "Uploading…"
              : isDragging
              ? "Drop to upload"
              : "Drag & drop or click to browse"}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] opacity-60">
            PNG · SVG · JPG · WEBP · max 2 MB
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--red)]">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Masked text input
───────────────────────────────────────────── */
function SecretInput({
  label,
  helper,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block font-mono text-[11px] uppercase tracking-widest text-[var(--text-dim)]">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? ""}
          autoComplete="off"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 pr-9 font-mono text-[12px] text-[var(--text)] outline-none transition-colors focus:border-[var(--red)]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="font-mono text-[10px] text-[var(--text-dim)] opacity-70">{helper}</p>
    </div>
  );
}

function PlainInput({
  label,
  helper,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block font-mono text-[11px] uppercase tracking-widest text-[var(--text-dim)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        autoComplete="off"
        className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 font-mono text-[12px] text-[var(--text)] outline-none transition-colors focus:border-[var(--red)]"
      />
      <p className="font-mono text-[10px] text-[var(--text-dim)] opacity-70">{helper}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section nav pill
───────────────────────────────────────────── */
function NavItem({
  num,
  title,
  active,
  done,
  onClick,
}: {
  num: number;
  title: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-all",
        active ? "bg-[var(--red-dim)] border border-[var(--red)]" : "border border-transparent hover:border-[var(--border)]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold",
          done
            ? "border-[#4ade80] text-[#4ade80]"
            : active
            ? "border-[var(--red)] text-[var(--red)]"
            : "border-[var(--border)] text-[var(--text-dim)]",
        ].join(" ")}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
      </div>
      <span
        className={[
          "font-mono text-[11px] uppercase tracking-wider",
          active ? "text-[var(--text)]" : "text-[var(--text-dim)]",
        ].join(" ")}
      >
        {title}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
function ClientLogoSection() {
  const [slug, setSlug] = useState<string>("");
  return (
    <div className="space-y-3">
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
          Client Slug
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          placeholder="acme-roofing"
          className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
        />
      </div>
      {slug ? (
        <LogoDropzone
          label="Client Logo"
          hint="Per-client logo. Stored under public/csvs/<slug>/ via the existing /api/upload-logo endpoint."
          target="client"
          clientSlug={slug}
          previewHeight="h-32"
        />
      ) : (
        <div className="rounded border border-dashed border-[var(--border)] p-6 text-center text-xs font-mono text-[var(--text-dim)]">
          Enter a client slug to upload their logo.
        </div>
      )}
    </div>
  );
}


export default function SetupPage() {
  const [activeSection, setActiveSection] = useState(0);

  // Meta API form state
  const [appId, setAppId]               = useState("");
  const [appSecret, setAppSecret]       = useState("");
  const [accessToken, setAccessToken]   = useState("");
  const [adAccountId, setAdAccountId]   = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  const [saveState, setSaveState]       = useState<SaveState>("idle");
  const [saveError, setSaveError]       = useState("");
  const [testState, setTestState]       = useState<TestState>("idle");
  const [testMsg, setTestMsg]           = useState("");

  // Load existing config on mount
  useEffect(() => {
    fetch("/api/get-meta-config")
      .then((r) => r.json())
      .then((d: { appId?: string; appSecret?: string; accessToken?: string; adAccountId?: string; configured?: boolean }) => {
        setAppId(d.appId ?? "");
        setAppSecret(d.appSecret ?? "");
        setAccessToken(d.accessToken ?? "");
        setAdAccountId(d.adAccountId ?? "");
        setIsConfigured(d.configured ?? false);
      })
      .catch(() => {/* ignore */});
  }, []);

  const handleSave = async () => {
    setSaveError("");
    setSaveState("saving");
    try {
      const res = await fetch("/api/save-meta-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, appSecret, accessToken, adAccountId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSaveError(data.error ?? "Save failed");
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      setIsConfigured(true);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveError("Network error");
      setSaveState("error");
    }
  };

  const handleTest = async () => {
    setTestMsg("");
    setTestState("testing");
    try {
      const res = await fetch("/api/test-meta-connection");
      const data = await res.json() as { ok?: boolean; name?: string; error?: string };
      if (data.ok) {
        setTestMsg(`Connected as ${data.name}`);
        setTestState("connected");
      } else {
        setTestMsg(data.error ?? "Connection failed");
        setTestState("failed");
      }
    } catch {
      setTestMsg("Network error");
      setTestState("failed");
    }
  };

  const sections = [
    { title: "Agency Branding", done: false },
    { title: "Meta API Connection", done: isConfigured },
  ];

  return (
    <main className="min-h-screen p-5 sm:p-8 lg:p-12" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--red)] transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </Link>
          <span className="text-[var(--border)]">/</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">Setup</span>
        </div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
          &gt; SNA Forensic / Setup
        </div>
        <h1
          className="text-3xl font-bold tracking-tight lg:text-4xl"
          style={{ fontFamily: "var(--font-head)" }}
        >
          Agency Setup
        </h1>
        <p className="mt-2 text-sm text-[var(--text-dim)]">
          Configure branding and API credentials for your agency.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">

        {/* ── Left: section nav ── */}
        <div className="space-y-2">
          <div className="panel-label mb-4">Sections</div>
          {sections.map((s, i) => (
            <NavItem
              key={i}
              num={i + 1}
              title={s.title}
              active={activeSection === i}
              done={s.done}
              onClick={() => setActiveSection(i)}
            />
          ))}
        </div>

        {/* ── Right: active section ── */}
        <div>

          {/* Section 1: Agency Branding */}
          {activeSection === 0 && (
            <div className="panel space-y-8">
              <div className="flex items-center justify-between">
                <div className="panel-label" style={{ marginBottom: 0 }}>Agency Branding</div>
                <Settings2 className="h-4 w-4 text-[var(--text-dim)]" />
              </div>

              <LogoDropzone
                label="Agency Logo"
                hint="Displayed in report headers and the auditor dashboard."
                target="agency"
                previewHeight="h-28"
              />

              <div className="border-t border-[var(--border)]" />

              <ClientLogoSection />

              <div className="border-t border-[var(--border)] pt-4">
                <p className="font-mono text-[10px] text-[var(--text-dim)]">
                  Client logos are managed per-client via <code className="text-[var(--text)]">/admin/clients/&lt;slug&gt;</code>.
                  The legacy <code className="text-[var(--text)]">public/csvs/&lt;slug&gt;/logo.png</code> path is still honored as a fallback.
                </p>
              </div>
            </div>
          )}

          {/* Section 2: Meta API */}
          {activeSection === 1 && (
            <div className="panel space-y-6">
              <div className="flex items-center justify-between">
                <div className="panel-label" style={{ marginBottom: 0 }}>Meta API Connection</div>
                <span
                  className={[
                    "status-pill font-mono",
                    isConfigured ? "status-ok" : "status-critical",
                  ].join(" ")}
                >
                  {isConfigured ? "CONFIGURED" : "NOT CONFIGURED"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <PlainInput
                  label="Meta App ID"
                  helper="Found in Meta Business → My Apps"
                  value={appId}
                  onChange={setAppId}
                  placeholder="1234567890"
                />
                <SecretInput
                  label="App Secret"
                  helper="Found in Meta Business → My Apps → Settings"
                  value={appSecret}
                  onChange={setAppSecret}
                  placeholder="Enter app secret"
                />
                <SecretInput
                  label="Access Token"
                  helper="Generate a long-lived token from Meta Graph Explorer"
                  value={accessToken}
                  onChange={setAccessToken}
                  placeholder="EAAxxxxxxxx…"
                />
                <PlainInput
                  label="Ad Account ID"
                  helper="Format: act_XXXXXXXXXX — found in Meta Ads Manager URL"
                  value={adAccountId}
                  onChange={setAdAccountId}
                  placeholder="act_1234567890"
                />
              </div>

              {/* Save + Test buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveState === "saving"}
                  className="flex items-center gap-2 rounded border border-[var(--red)] bg-[var(--red-dim)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[var(--red)] transition-all hover:bg-[var(--red)] hover:text-black disabled:opacity-50"
                >
                  {saveState === "saving" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : saveState === "saved" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#4ade80]" />
                  ) : null}
                  {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved!" : "Save Credentials"}
                </button>

                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testState === "testing"}
                  className="flex items-center gap-2 rounded border border-[var(--border)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[#4ade80] hover:text-[#4ade80] disabled:opacity-50"
                >
                  {testState === "testing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {testState === "testing" ? "Testing…" : "Test Connection"}
                </button>
              </div>

              {/* Inline feedback */}
              {saveState === "error" && (
                <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--red)]">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              {testState === "connected" && (
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#4ade80]">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  {testMsg}
                </div>
              )}
              {testState === "failed" && (
                <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--red)]">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {testMsg}
                </div>
              )}

              <div className="border-t border-[var(--border)] pt-4">
                <p className="font-mono text-[10px] text-[var(--text-dim)]">
                  Credentials are stored in <code className="text-[var(--text)]">config/meta.json</code> at the project root —
                  outside <code className="text-[var(--text)]">public/</code> and excluded from git.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
