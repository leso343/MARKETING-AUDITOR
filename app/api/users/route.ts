/**
 * /api/users
 *   GET    — list users (admin: all, agency: own agency only).
 *   POST   — create a new user (admin only).
 *   PATCH  — update user role / agency assignment / name.
 *   DELETE — delete a user (admin only, cannot delete self).
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, count } from "drizzle-orm";
import { auth, authEnabled, bumpTokenVersion } from "@/auth";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { log } from "@/lib/logger";
import { getBillingState, countAgencySeats } from "@/lib/billing-access";

function guard() {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      { error: "User management requires AUTH_SECRET and DATABASE_URL." },
      { status: 503 },
    );
  }
  return null;
}

/* ── GET — list users ────────────────────────────────────────────────── */

export async function GET() {
  const g = guard();
  if (g) return g;

  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let rows;
    if (session.user.role === "admin") {
      rows = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          agencyId: schema.users.agencyId,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users);
    } else {
      if (!session.user.agencyId) return NextResponse.json([]);
      rows = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          agencyId: schema.users.agencyId,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.agencyId, session.user.agencyId));
    }

    return NextResponse.json(rows);
  } catch (error) {
    log.error("GET /api/users failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ── POST — create user (admin only) ─────────────────────────────────── */

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;

  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      agencyId?: string;
    };

    if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!body.password || typeof body.password !== "string" || body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: `Email "${email}" already exists` }, { status: 409 });
    }

    const role = body.role === "admin" ? "admin" : "agency";

    // C-7 seat cap: when creating a non-admin user attached to an
    // agency, refuse if the agency is at its seat limit.
    if (role === "agency" && body.agencyId) {
      const billing = await getBillingState(body.agencyId);
      const seatLimit = billing.plan.seatLimit;
      if (Number.isFinite(seatLimit)) {
        const seats = await countAgencySeats(body.agencyId);
        if (seats >= seatLimit) {
          return NextResponse.json(
            {
              error: `That agency's ${billing.plan.id} plan allows up to ${seatLimit} seat${seatLimit === 1 ? "" : "s"}.`,
              code: "SEAT_LIMIT",
            },
            { status: 403 },
          );
        }
      }
    }

    const id = randomUUID();
    const passwordHash = await hash(body.password, 12);

    await db.insert(schema.users).values({
      id,
      email,
      name: body.name?.trim() || null,
      passwordHash,
      role,
      agencyId: body.agencyId || null,
    });

    return NextResponse.json({ id, email, role, agencyId: body.agencyId || null }, { status: 201 });
  } catch (error) {
    log.error("POST /api/users failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ── PATCH — update user ─────────────────────────────────────────────── */

export async function PATCH(req: Request) {
  const g = guard();
  if (g) return g;

  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      name?: string;
      role?: string;
      agencyId?: string | null;
      password?: string;
    };

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const rows = await db.select().from(schema.users).where(eq(schema.users.id, body.userId)).limit(1);
    const target = rows[0];
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // H-3 fix: block self-demotion. Without this an admin can flip
    // their own role to 'agency' and lock the platform out of admin
    // capabilities (no UI to fix it).
    if (body.userId === session.user.id && body.role === "agency") {
      return NextResponse.json(
        { error: "You can't demote yourself. Ask another admin to do it." },
        { status: 400 },
      );
    }
    // H-3 fix: block demoting the LAST remaining admin. Same lockout
    // risk if e.g. admin A demotes admin B before A demotes themselves.
    if (target.role === "admin" && body.role === "agency") {
      const adminCount = await db
        .select({ c: count() })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"));
      if ((adminCount[0]?.c ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last remaining admin." },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    let mustBumpToken = false;
    if (typeof body.name === "string") updates.name = body.name.trim() || null;
    if (body.role === "admin" || body.role === "agency") {
      if (body.role !== target.role) mustBumpToken = true;
      updates.role = body.role;
    }
    if (body.agencyId === null) {
      if (target.agencyId !== null) mustBumpToken = true;
      updates.agencyId = null;
    } else if (typeof body.agencyId === "string" && body.agencyId.trim()) {
      if (body.agencyId.trim() !== target.agencyId) mustBumpToken = true;
      updates.agencyId = body.agencyId.trim();
    }
    if (typeof body.password === "string" && body.password.length >= 8) {
      updates.passwordHash = await hash(body.password, 12);
      mustBumpToken = true; // force re-auth on password change
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await db.update(schema.users).set(updates).where(eq(schema.users.id, body.userId));

    // H-4 integration: bump tokenVersion when role / agency / password
    // changed. Forces the target user's existing JWTs to fail on the
    // next request.
    if (mustBumpToken) {
      await bumpTokenVersion(body.userId);
    }
    const fresh = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        agencyId: schema.users.agencyId,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, body.userId))
      .limit(1);

    return NextResponse.json(fresh[0] ?? { ok: true });
  } catch (error) {
    log.error("PATCH /api/users failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ── DELETE — delete user ────────────────────────────────────────────── */

export async function DELETE(req: Request) {
  const g = guard();
  if (g) return g;

  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId query param required" }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!rows[0]) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // H-3 fix: refuse to delete the last admin.
    if (rows[0].role === "admin") {
      const adminCount = await db
        .select({ c: count() })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"));
      if ((adminCount[0]?.c ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last remaining admin." },
          { status: 400 },
        );
      }
    }

    // H-4 integration: bump tokenVersion BEFORE delete so any
    // concurrent JWT check on this user fails. The cascade on
    // ON DELETE will clean up; the post-delete jwt callback will
    // return null when the user row is gone.
    await bumpTokenVersion(userId);
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    return NextResponse.json({ ok: true, deleted: rows[0].email });
  } catch (error) {
    log.error("DELETE /api/users failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
