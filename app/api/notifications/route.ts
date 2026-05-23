/**
 * GET  /api/notifications — list current user's notifications (newest first).
 * PATCH /api/notifications — mark notifications as read.
 *
 * Query params:
 *   ?unread=true  — only unread
 *   ?limit=20     — max items (default 20)
 *
 * PATCH body:
 *   { ids: string[] }           — mark specific IDs as read
 *   { markAllRead: true }       — mark all as read
 */
import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { auth, authEnabled } from "@/auth";

export async function GET(req: Request) {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);

  const conditions = [eq(schema.notifications.userId, session.user.id)];
  if (unreadOnly) {
    conditions.push(eq(schema.notifications.read, 0));
  }

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);

  // Unread count (always computed, regardless of filter)
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

  const body = await req.json().catch(() => null);

  if (body?.markAllRead) {
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

  const ids = body?.ids;
  if (Array.isArray(ids) && ids.length > 0) {
    // Mark each specified notification as read (only if owned by user)
    for (const id of ids) {
      await db
        .update(schema.notifications)
        .set({ read: 1 })
        .where(
          and(
            eq(schema.notifications.id, String(id)),
            eq(schema.notifications.userId, session.user.id),
          ),
        );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide ids[] or markAllRead" }, { status: 400 });
}
