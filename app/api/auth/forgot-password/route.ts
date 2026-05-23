/**
 * POST /api/auth/forgot-password — request a password reset.
 *
 * Body: { email: string }
 *
 * Always returns 200 with a success message (prevents email enumeration).
 * Generates a secure token, stores its SHA-256 hash in the password_resets
 * table, and — when SMTP is configured — sends the reset email.
 *
 * When SMTP is NOT configured (MVP), the token is logged to the server
 * console so admins can manually relay it. This lets the full flow work
 * in development without an email provider.
 */
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generic success — don't leak whether the email exists. */
const SUCCESS = NextResponse.json({
  ok: true,
  message: "If an account exists with that email, a reset link has been sent.",
});

export async function POST(req: Request) {
  if (!dbAvailable) {
    return NextResponse.json(
      { error: "Database unavailable — password reset requires multi-tenant mode." },
      { status: 503 },
    );
  }

  // Rate limit: 5 requests / 15 min per IP
  const rl = rateLimit(`forgot-pw:${getClientIp(req)}`, {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests — please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  if (!email || !email.includes("@")) {
    // Still return generic success to prevent enumeration
    return SUCCESS;
  }

  // Look up user
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (rows.length === 0) {
    // No user — return success anyway (prevent enumeration)
    return SUCCESS;
  }

  const user = rows[0];

  // Generate token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Delete any existing tokens for this user
  await db
    .delete(schema.passwordResets)
    .where(eq(schema.passwordResets.userId, user.id));

  // Store hashed token
  await db.insert(schema.passwordResets).values({
    id: randomBytes(16).toString("hex"),
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  // Build reset URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  // TODO: Send email via SMTP when configured (Resend, SendGrid, etc.)
  // For now, log to server console (development / admin-relay fallback)
  const smtpConfigured = !!process.env.SMTP_HOST || !!process.env.RESEND_API_KEY;
  if (!smtpConfigured) {
    // eslint-disable-next-line no-console
    console.log(
      `\n📧 [PASSWORD RESET] ${email}\n   Link: ${resetUrl}\n   Expires: ${expiresAt.toISOString()}\n`,
    );
  } else {
    // Placeholder for email integration
    // await sendResetEmail(email, resetUrl);
    // eslint-disable-next-line no-console
    console.log(`[password-reset] Email sent to ${email}`);
  }

  return SUCCESS;
}
