/**
 * POST /api/auth/reset-password — consume a reset token and set a new password.
 *
 * Body: { token: string, password: string }
 *
 * Validates:
 *   - Token exists and hasn't expired
 *   - Password meets minimum length (8 chars)
 *
 * On success: hashes new password, updates user, deletes the token.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  if (!dbAvailable) {
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }

  // Rate limit: 10 attempts / 15 min per IP
  const rl = rateLimit(`reset-pw:${getClientIp(req)}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many attempts — please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = await req.json().catch(() => null);
  const rawToken = (body?.token ?? "").toString().trim();
  const password = (body?.password ?? "").toString();

  if (!rawToken) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(rawToken);

  // Find valid (non-expired) token
  const rows = await db
    .select()
    .from(schema.passwordResets)
    .where(
      and(
        eq(schema.passwordResets.tokenHash, tokenHash),
        gt(schema.passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Invalid or expired reset link. Please request a new one." },
      { status: 400 },
    );
  }

  const resetRow = rows[0];

  // Hash new password
  const newHash = await bcrypt.hash(password, 12);

  // Update user password
  await db
    .update(schema.users)
    .set({ passwordHash: newHash })
    .where(eq(schema.users.id, resetRow.userId));

  // Delete the used token (and any others for this user)
  await db
    .delete(schema.passwordResets)
    .where(eq(schema.passwordResets.userId, resetRow.userId));

  return NextResponse.json({ ok: true });
}
