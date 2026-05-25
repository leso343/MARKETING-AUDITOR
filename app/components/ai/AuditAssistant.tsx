"use client";

/**
 * AuditAssistant — iOS-style floating AI chat panel.
 *
 * Visual language modeled on iPhone Messages / Apple Intelligence:
 *   - Sheet with rounded top corners + drag-indicator grabber
 *   - SF Pro font stack via system-ui / -apple-system
 *   - iMessage-style bubbles (brand red for user, system gray for assistant)
 *   - Pill input with circular send button
 *   - Vibrancy / translucency on the sheet background
 *
 * Behavior is unchanged from the previous version:
 *   - Streaming responses with markdown rendering
 *   - Suggested starter chips on empty state
 *   - Copy / new / clear in the nav bar
 *   - Esc closes; Enter sends; Shift+Enter newline
 *   - Grounded in the audit (clientSlug) or redirect mode (null)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  ArrowUp,
  Copy,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
}

interface Props {
  /** Slug of the client whose audit is currently being viewed. Null on non-audit pages. */
  clientSlug: string | null;
  /** Display name for the suggested-chip context. */
  clientName?: string | null;
}

const STARTER_CHIPS_AUDIT = [
  "What should I fix first?",
  "Why is my CPL so high?",
  "Draft a client summary email",
  "Explain the funnel leakage finding",
];

// Apple SF Pro font stack — falls back to system fonts on every device.
const IOS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif';

export default function AuditAssistant({ clientSlug, clientName }: Props) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new content.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Focus input on open.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Auto-grow textarea like iMessage.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const resetConversation = useCallback(() => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      setError(null);
      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: text },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientSlug, conversationId, message: text }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            if (!frame.startsWith("data: ")) continue;
            const json = frame.slice(6);
            try {
              const event = JSON.parse(json);
              if (event.type === "meta" && event.conversationId) {
                setConversationId(event.conversationId);
              } else if (event.type === "delta" && event.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.text } : m,
                  ),
                );
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message.startsWith("Unexpected")) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)));
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [clientSlug, conversationId, streaming],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const copyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const chips = STARTER_CHIPS_AUDIT;
  const hasAudit = Boolean(clientSlug);

  return (
    <>
      {/* ── Floating action button (iOS-style circular) ────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="ios-fab"
          style={{ fontFamily: IOS_FONT }}
        >
          <Sparkles className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </button>
      )}

      {/* ── iOS-style sheet ────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Dim backdrop (iOS sheets always have this when modal) */}
          <div
            className="ios-sheet-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <aside
            role="dialog"
            aria-label="AI Assistant"
            className="ios-sheet"
            style={{ fontFamily: IOS_FONT }}
          >
            {/* Grabber */}
            <div className="ios-grabber-wrap">
              <div className="ios-grabber" />
            </div>

            {/* Nav bar */}
            <header className="ios-navbar">
              <div className="ios-navbar-side">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={resetConversation}
                    aria-label="New conversation"
                    className="ios-navbar-btn"
                  >
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                )}
              </div>
              <div className="ios-navbar-title">
                <div className="ios-avatar">
                  <Sparkles className="h-[14px] w-[14px]" strokeWidth={2.4} />
                </div>
                <div className="ios-navbar-title-text">
                  <div className="ios-title">Audit Assistant</div>
                  <div className="ios-subtitle">
                    {hasAudit ? clientName ?? clientSlug ?? "—" : "No audit loaded"}
                  </div>
                </div>
              </div>
              <div className="ios-navbar-side ios-navbar-side--right">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={resetConversation}
                    aria-label="Clear conversation"
                    className="ios-navbar-btn"
                  >
                    <Trash2 className="h-[16px] w-[16px]" strokeWidth={2.2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="ios-navbar-btn ios-navbar-close"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                </button>
              </div>
            </header>

            {/* Messages scroll area */}
            <div ref={scrollRef} className="ios-messages">
              {messages.length === 0 ? (
                <IosEmptyState
                  hasAudit={hasAudit}
                  chips={chips}
                  onPickChip={(t) => send(t)}
                />
              ) : (
                <div className="space-y-3 py-4">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <IosUserBubble key={m.id} content={m.content} />
                    ) : (
                      <IosAssistantBubble
                        key={m.id}
                        content={m.content}
                        isStreaming={streaming && i === messages.length - 1}
                        copied={copiedId === m.id}
                        onCopy={() => copyMessage(m.id, m.content)}
                      />
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="ios-error">
                <AlertCircle className="h-[14px] w-[14px]" />
                <span>{error}</span>
              </div>
            )}

            {/* Input bar */}
            <form onSubmit={onSubmit} className="ios-inputbar">
              <div className="ios-input-pill">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  disabled={streaming || !hasAudit}
                  placeholder={hasAudit ? "Message" : "Open an audit to chat"}
                  rows={1}
                  className="ios-input"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || streaming || !hasAudit}
                aria-label="Send"
                className={`ios-send ${input.trim() && !streaming && hasAudit ? "ios-send--active" : ""}`}
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

/* ── iOS empty state — hero icon + iOS-list-row suggested questions ──── */
function IosEmptyState({
  hasAudit,
  chips,
  onPickChip,
}: {
  hasAudit: boolean;
  chips: string[];
  onPickChip: (text: string) => void;
}) {
  if (!hasAudit) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="ios-empty-hero ios-empty-hero--muted">
          <MessageSquare className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h3 className="ios-empty-title">Audit data needed</h3>
        <p className="ios-empty-body max-w-[280px]">
          Open a client&apos;s audit to chat with the assistant. It can only answer
          questions grounded in real audit data.
        </p>
      </div>
    );
  }

  return (
    <div className="px-2 py-8">
      <div className="text-center">
        <div className="ios-empty-hero ios-empty-hero--brand">
          <Sparkles className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h3 className="ios-empty-title">Ask anything about this audit</h3>
        <p className="ios-empty-body">I can only reference numbers from your data.</p>
      </div>

      <div className="ios-list-section">
        <div className="ios-list-section-header">Suggested</div>
        <div className="ios-list">
          {chips.map((chip, i) => (
            <button
              key={chip}
              type="button"
              onClick={() => onPickChip(chip)}
              className={`ios-list-row ${i === 0 ? "ios-list-row--first" : ""} ${i === chips.length - 1 ? "ios-list-row--last" : ""}`}
            >
              <span>{chip}</span>
              <span className="ios-list-row-chevron">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── User bubble — iMessage-style brand-red gradient, right-aligned ──── */
function IosUserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end px-3">
      <div className="ios-bubble ios-bubble--user">{content}</div>
    </div>
  );
}

/* ── Assistant bubble — iMessage-style gray, left-aligned with avatar ── */
function IosAssistantBubble({
  content,
  isStreaming,
  copied,
  onCopy,
}: {
  content: string;
  isStreaming: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex gap-2 px-3 items-end">
      <div className="ios-avatar-sm">
        <Sparkles className="h-[11px] w-[11px]" strokeWidth={2.4} />
      </div>
      <div className="flex flex-col min-w-0 max-w-[78%]">
        <div className="ios-bubble ios-bubble--assistant prose-assistant">
          {content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <div className="flex items-center gap-1 py-0.5">
              <span className="ios-dot" />
              <span className="ios-dot" style={{ animationDelay: "150ms" }} />
              <span className="ios-dot" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
        {content && !isStreaming && (
          <button
            type="button"
            onClick={onCopy}
            className="ios-bubble-action"
            aria-label="Copy message"
          >
            {copied ? (
              <>
                <Check className="h-[10px] w-[10px]" strokeWidth={2.5} /> Copied
              </>
            ) : (
              <>
                <Copy className="h-[10px] w-[10px]" strokeWidth={2.2} /> Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
