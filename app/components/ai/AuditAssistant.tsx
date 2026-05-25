"use client";

/**
 * AuditAssistant — floating AI chat panel.
 *
 * Mounted on every authenticated page. When `clientSlug` is provided
 * (audit pages) the assistant has the audit context loaded server-side
 * and answers grounded questions. When `clientSlug` is null, the
 * assistant gracefully redirects users to open an audit.
 *
 * UX:
 *   - Bottom-right FAB → opens a right-side slide-in panel (desktop)
 *     or full-height bottom sheet (mobile).
 *   - Streaming responses with markdown rendering.
 *   - Suggested starter chips on empty state.
 *   - Copy-to-clipboard on each assistant message.
 *   - "New" / "Clear" controls in header.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  Plus,
  Trash2,
  Loader2,
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

const STARTER_CHIPS_NO_AUDIT = [
  "Open a client's audit to start",
];

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on open.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

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
          body: JSON.stringify({
            clientSlug,
            conversationId,
            message: text,
          }),
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

          // SSE frames are split by \n\n.
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
                    m.id === assistantId
                      ? { ...m, content: m.content + event.text }
                      : m,
                  ),
                );
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseErr) {
              // Ignore malformed frames silently — partial reads happen.
              if (parseErr instanceof Error && parseErr.message.startsWith("Unexpected"))
                continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        // Remove the empty assistant placeholder if it never got content.
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
      // ignore
    }
  };

  const chips = clientSlug ? STARTER_CHIPS_AUDIT : STARTER_CHIPS_NO_AUDIT;
  const hasAudit = Boolean(clientSlug);

  return (
    <>
      {/* ── Floating action button ─────────────────────────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--red)] text-white shadow-[0_4px_24px_rgba(255,0,0,0.4)] hover:shadow-[0_6px_32px_rgba(255,0,0,0.6)] transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-5 w-5" />
          <span className="sr-only">Ask AI</span>
        </button>
      )}

      {/* ── Slide-in panel ─────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />

          <aside
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--card)] shadow-2xl lg:bottom-0 lg:right-0 lg:top-0 lg:inset-x-auto lg:max-h-none lg:h-screen lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0"
            role="dialog"
            aria-label="AI Assistant"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--red)]/10">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--red)]" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">Audit Assistant</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] truncate">
                    {hasAudit ? clientName ?? clientSlug ?? "—" : "No audit loaded"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={resetConversation}
                      title="New conversation"
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-dim)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={resetConversation}
                      title="Clear conversation"
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-dim)] hover:bg-[var(--bg)] hover:text-[var(--red)] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Close"
                  className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-dim)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <EmptyState
                  hasAudit={hasAudit}
                  chips={chips}
                  onPickChip={(t) => send(t)}
                />
              ) : (
                messages.map((m) =>
                  m.role === "user" ? (
                    <UserBubble key={m.id} content={m.content} />
                  ) : (
                    <AssistantBubble
                      key={m.id}
                      content={m.content}
                      isStreaming={streaming && m === messages[messages.length - 1]}
                      copied={copiedId === m.id}
                      onCopy={() => copyMessage(m.id, m.content)}
                    />
                  ),
                )
              )}
            </div>

            {/* Error surface */}
            {error && (
              <div className="mx-4 mb-2 flex items-start gap-2 rounded bg-[var(--red)]/10 border border-[var(--red)]/20 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--red)] mt-0.5" />
                <p className="text-[11px] text-[var(--red)]">{error}</p>
              </div>
            )}

            {/* Input */}
            <form onSubmit={onSubmit} className="border-t border-[var(--border)] p-3">
              <div className="flex items-end gap-2">
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
                  placeholder={
                    hasAudit
                      ? "Ask about this audit…"
                      : "Open an audit to chat"
                  }
                  rows={1}
                  className="flex-1 resize-none bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--red)] outline-none max-h-32 disabled:opacity-50"
                  style={{ minHeight: "40px" }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming || !hasAudit}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--red)] text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Send"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] text-center">
                Grounded in your audit · Enter to send · Shift+Enter for newline
              </p>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

/* ── Empty state with suggested-question chips ───────────────────────── */
function EmptyState({
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
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg)] border border-[var(--border)] mb-4">
          <MessageSquare className="h-5 w-5 text-[var(--text-dim)]" />
        </div>
        <h3 className="text-sm font-semibold mb-2">Audit data needed</h3>
        <p className="text-xs text-[var(--text-dim)] max-w-[280px] leading-relaxed">
          Open a client&apos;s audit to chat with the assistant. It can only answer
          questions grounded in real audit data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center pt-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--red)]/10 mx-auto mb-3">
          <Sparkles className="h-5 w-5 text-[var(--red)]" />
        </div>
        <h3 className="text-sm font-semibold mb-1">Ask anything about this audit</h3>
        <p className="text-xs text-[var(--text-dim)]">
          I can only reference numbers from your data.
        </p>
      </div>
      <div className="space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] text-center">
          Try one of these
        </div>
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onPickChip(chip)}
            className="w-full text-left rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-xs hover:border-[var(--red)]/40 hover:bg-[var(--red)]/[0.03] transition-all"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Message bubbles ─────────────────────────────────────────────────── */
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--red)]/10 border border-[var(--red)]/20 px-3.5 py-2 text-sm whitespace-pre-wrap break-words">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
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
    <div className="flex gap-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--red)]/10 mt-0.5">
        <Sparkles className="h-3 w-3 text-[var(--red)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm prose-assistant">
          {content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--text-dim)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-dim)] animate-pulse" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-dim)] animate-pulse [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-dim)] animate-pulse [animation-delay:300ms]" />
            </div>
          )}
        </div>
        {content && !isStreaming && (
          <div className="mt-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="h-2.5 w-2.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-2.5 w-2.5" /> Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
