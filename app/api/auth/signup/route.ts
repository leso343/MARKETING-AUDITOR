/**
 * POST /api/auth/signup — create a new agency + user + free trial.
 *
 * Body: { email, password, name?, agencyName? }
 * Returns: { ok: true, agencyId, userId } on success.
 *
 * Fixes C-1 (no signup endpoint — customers couldn't actually buy).
 *
 * Flow:
 *   1. Validate email + password
 *   2. Reject if email already exists
 *   3. Create an agency (slug derived from agencyName, with random
 *      suffix on collision)
 *   4. Create the user (role=agency, hashed password)
 *   5. Create a subscriptions row (plan=free, status=trialing,
 *      trialStartedAt=now) → kicks off the 7-day window enforced by
 *      lib/billing-access.getBillingState (FREE_TRIAL_DAYS in lib/plans.ts)
 *   6. Fire-and-forget a welcome email via Resend
 *
 * Client signs in via NextAuth's signIn("credentials") after this
 * returns 200.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { db, schema, dbAvailable } from "@/lib/db";
import { authEnabled } from "@/auth";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { log } from "@/lib/logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || `agency-${randomBytes(3).toString("hex")}`;
  for (let i = 0; i < 5; i++) {
    const hit = await db
      .select({ id: schema.agencies.id })
      .from(schema.agencies)
      .where(eq(schema.agencies.slug, slug))
      .limit(1);
    if (!hit[0]) return slug;
    slug = `${base}-${randomBytes(2).toString("hex")}`.slice(0, 62);
  }
  return `${base}-${randomBytes(4).toString("hex")}`.slice(0, 62);
}

export async function POST(req: Request) {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      { error: "Signup is disabled — multi-tenant features require AUTH_SECRET and DATABASE_URL." },
      { status: 503 },
    );
  }

  // 5 signups per IP per hour — tighter than forgot-password since each
  // creates DB rows we can't easily clean up.
  const rl = rateLimit(`signup:${getClientIp(req)}`, { max: 5, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many signup attempts — please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    agencyName?: unknown;
  };

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const agencyName =
    typeof body.agencyName === "string" && body.agencyName.trim().length >= 2
      ? body.agencyName.trim()
      : email.split("@")[0].replace(/[._-]+/g, " ") || "My Agency";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  try {
    // Reject duplicate emails — also helps when the user forgot they
    // have an account (we direct them to reset).
    const existingUser = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existingUser[0]) {
      return NextResponse.json(
        {
          error: "An account already exists for that email. Try signing in or resetting your password.",
          code: "EMAIL_TAKEN",
        },
        { status: 409 },
      );
    }

    const slug = await ensureUniqueSlug(slugifyName(agencyName));

    const agencyId = randomUUID();
    const userId = randomUUID();
    const subId = randomUUID();
    const passwordHash = await hash(password, 12);
    const now = new Date();

    // Sequential inserts with rollback on failure — Drizzle/libsql
    // transactions vary by driver version.
    await db.insert(schema.agencies).values({
      id: agencyId,
      slug,
      name: agencyName,
      primaryColor: "#ff0000",
    });

    try {
      await db.insert(schema.users).values({
        id: userId,
        email,
        name,
        passwordHash,
        role: "agency",
        agencyId,
      });
    } catch (err) {
      await db.delete(schema.agencies).where(eq(schema.agencies.id, agencyId)).catch(() => {});
      throw err;
    }

    try {
      await db.insert(schema.subscriptions).values({
        id: subId,
        agencyId,
        plan: "free",
        status: "trialing",
        trialStartedAt: now,
      });
    } catch (err) {
      await db.delete(schema.users).where(eq(schema.users.id, userId)).catch(() => {});
      await db.delete(schema.agencies).where(eq(schema.agencies.id, agencyId)).catch(() => {});
      throw err;
    }

    // Welcome email — best-effort, no-op when RESEND_API_KEY unset.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      new URL(req.url).origin;
    const { subject, html, text } = welcomeEmail(name ?? email.split("@")[0], `${baseUrl}/login`);
    void sendEmail({ to: email, subject, html, text });

    return NextResponse.json({ ok: true, agencyId, userId }, { status: 201 });
  } catch (err) {
    log.error("POST /api/auth/signup failed", err);
    return NextResponse.json({ error: "Signup failed — please try again." }, { status: 500 });
  }
}
