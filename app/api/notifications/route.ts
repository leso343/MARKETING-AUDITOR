/**
 * GET  /api/notifications — list current user's notifications (newest first).
 * PATCH /api/notifications — mark notifications as read.
 *
 * Audit fixes:
 *   - NEW-H-21: per-IP rate limit on both verbs; PATCH `ids[]` capped
 *     at 100 entries; multiple-id updates use a single IN query
 *     instead of N round-trips.
 *   - M-9:      JSON body capped at 64 KB.
 *
 * Query params:
 *   ?unread=true  — only unread
 *   ?limit=20     — max items (default 20)
 *
 * PATCH body:
 *   { ids: string[] }     — mark specific IDs as read (max 100)
 *   { markAllRead: true } — mark all as read
 */
import { NextResponse } from "next/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { auth, authEnabled } from "@/auth";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/api-helpers";

const MAX_IDS = 100;

export async function GET(req: Request) {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // NEW-H-21: NotificationBell polls 30s. Cap to 120/min/IP — well
  // above legitimate traffic, but blocks a tight-loop client.
  const rl = rateLimit(`notif-get:${getClientIp(req)}`, { max: 120, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);

  const conditions = [eq(schema.notifications.userId, session.user.id)];
  if (unreadOnly) conditions.push(eq(schema.notifications.read, 0));

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);

  const unreadRows = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        eq(schema.notifications.read, 0),
      ),
    );

  return NextResponse.json({
    notifications: rows,
    unreadCount: unreadRows.length,
  });
}

export async function PATCH(req: Request) {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json({ ok: true });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`notif-patch:${getClientIp(req)}`, { max: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // M-9: cap body. NEW-H-21: cap ids[].
  const parsed = await parseJsonBody<{ ids?: unknown; markAllRead?: unknown }>(req, {
    maxBytes: 16 * 1024,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.data;

  if (body.markAllRead) {
    await db
      .update(schema.notifications)
      .set({ read: 1 })
      .where(
        and(
          eq(schema.notifications.userId, session.user.id),
          eq(schema.notifications.read, 0),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  const rawIds = body.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: "Provide ids[] or markAllRead" }, { status: 400 });
  }
  if (rawIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many ids — max ${MAX_IDS} per call.` },
      { status: 400 },
    );
  }
  const ids = rawIds
    .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64)
    .slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // NEW-H-21: single UPDATE … WHERE id IN (…) instead of N round-trips.
  await db
    .update(schema.notifications)
    .set({ read: 1 })
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        inArray(schema.notifications.id, ids),
      ),
    );

  return NextResponse.json({ ok: true });
}
