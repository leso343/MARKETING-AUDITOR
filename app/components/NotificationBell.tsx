"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, CreditCard, FileCheck, Sparkles, Info } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  read: number;
  createdAt: number | string;
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  audit_complete: FileCheck,
  payment_issue: CreditCard,
  payment_resolved: Check,
  welcome: Sparkles,
  system: Info,
};

function timeAgo(dateInput: number | string): string {
  const ms = typeof dateInput === "number" ? dateInput : new Date(dateInput).getTime();
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // Poll every 30s + initial fetch
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (n.actionUrl) {
      window.location.href = n.actionUrl;
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center h-8 w-8 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text-dim)] transition-colors hover:text-[var(--text)] hover:border-[var(--red)]"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[340px] max-h-[420px] overflow-hidden rounded border border-[var(--border)] bg-[var(--card)] shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--text-dim)]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--red)] transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[350px] divide-y divide-[var(--border)]">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-6 w-6 mx-auto mb-2 text-[var(--text-dim)] opacity-40" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`
                      w-full text-left px-4 py-3 flex gap-3 transition-colors
                      hover:bg-[var(--bg)]
                      ${!n.read ? "bg-[var(--red)]/[0.03]" : ""}
                    `}
                  >
                    {/* Icon */}
                    <div className={`
                      mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full
                      ${!n.read
                        ? "bg-[var(--red)]/10 text-[var(--red)]"
                        : "bg-[var(--border)] text-[var(--text-dim)]"
                      }
                    `}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium truncate ${!n.read ? "text-[var(--text)]" : "text-[var(--text-dim)]"}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-[var(--red)] mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-dim)] line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="font-mono text-[9px] text-[var(--text-dim)] mt-1 opacity-60">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
