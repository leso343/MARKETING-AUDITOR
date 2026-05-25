/**
 * BYO Anthropic key management — Agency tier only.
 *
 *   GET    → { configured: boolean, keyMask?, validated?, lastValidatedAt? }
 *   POST   { key: string }  → validates the key against Anthropic, encrypts,
 *                             stores it. Returns the same shape as GET.
 *   DELETE → removes the agency's BYO key (falls back to server key).
 *
 * Auth: requires a signed-in user whose agency is on the "agency" plan.
 * Pro/Free can't BYO — they use the server key (with tier caps).
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { tryGetUser } from "@/lib/access";
import { authEnabled } from "@/auth";
import { getBillingState } from "@/lib/billing-access";
import { encryptSecret, maskSecret, isCryptoConfigured } from "@/lib/crypto";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function badConfig() {
  return NextResponse.json(
    { error: "BYO key feature unavailable — set AI_KEY_ENCRYPTION_SECRET in environment." },
    { status: 503 },
  );
}

/**
 * Feature flag — flip on by setting BYO_KEYS_ENABLED=true on Vercel.
 * When off, the endpoint returns 503 with a "coming soon" message and
 * the chat route ignores any stored BYO keys (so nothing leaks if a
 * key was added during testing).
 */
function isByoEnabled(): boolean {
  return process.env.BYO_KEYS_ENABLED === "true";
}

function comingSoonResponse() {
  return NextResponse.json(
    {
      error: "Coming soon — BYO key is in private beta. Available on the Agency plan at launch.",
      code: "COMING_SOON",
    },
    { status: 503 },
  );
}

async function requireAgencyUser() {
  if (!authEnabled || !dbAvailable) return { error: "Auth disabled.", status: 503 };
  const user = await tryGetUser();
  if (!user) return { error: "Sign in required.", status: 401 };
  if (!user.agencyId) {
    return { error: "You must be on a team with an agency.", status: 403 };
  }
  const billing = await getBillingState(user.agencyId);
  if (!billing.ok || billing.plan.id !== "agency") {
    return {
      error: "Bring-your-own-key is an Agency-plan feature.",
      status: 403,
      code: "AGENCY_REQUIRED",
    };
  }
  return { user, agencyId: user.agencyId };
}

export async function GET() {
  if (!isByoEnabled()) return comingSoonResponse();
  const auth = await requireAgencyUser();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: (auth as { code?: string }).code },
      { status: auth.status },
    );
  }
  const rows = await db
    .select({
      keyMask: schema.agencyAiConfigs.keyMask,
      validated: schema.agencyAiConfigs.validated,
      lastValidatedAt: schema.agencyAiConfigs.lastValidatedAt,
    })
    .from(schema.agencyAiConfigs)
    .where(eq(schema.agencyAiConfigs.agencyId, auth.agencyId))
    .limit(1);
  const row = rows[0];
  if (!row) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    keyMask: row.keyMask,
    validated: row.validated === 1,
    lastValidatedAt: row.lastValidatedAt,
  });
}

export async function POST(req: Request) {
  if (!isByoEnabled()) return comingSoonResponse();
  if (!isCryptoConfigured()) return badConfig();
  const auth = await requireAgencyUser();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: (auth as { code?: string }).code },
      { status: auth.status },
    );
  }

  const body = (await req.json().catch(() => null)) as { key?: string } | null;
  const key = body?.key?.trim();
  if (!key) {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }
  // Sanity: Anthropic keys look like `sk-ant-…`.
  if (!/^sk-ant-/i.test(key) || key.length < 30 || key.length > 200) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Anthropic API key (sk-ant-…)." },
      { status: 400 },
    );
  }

  // Validate by making the cheapest possible API call.
  try {
    const client = new Anthropic({ apiKey: key });
    await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
  } catch (err) {
    log.error("[byo-key] validation failed", err);
    const msg = err instanceof Error ? err.message : "Key validation failed.";
    return NextResponse.json(
      {
        error: `Anthropic rejected the key: ${msg}. Check it has billing enabled and isn't revoked.`,
      },
      { status: 400 },
    );
  }

  const encryptedKey = encryptSecret(key);
  const keyMask = maskSecret(key);
  const now = new Date();

  // Upsert.
  const existing = await db
    .select({ agencyId: schema.agencyAiConfigs.agencyId })
    .from(schema.agencyAiConfigs)
    .where(eq(schema.agencyAiConfigs.agencyId, auth.agencyId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.agencyAiConfigs)
      .set({ encryptedKey, keyMask, validated: 1, lastValidatedAt: now, updatedAt: now })
      .where(eq(schema.agencyAiConfigs.agencyId, auth.agencyId));
  } else {
    await db.insert(schema.agencyAiConfigs).values({
      agencyId: auth.agencyId,
      encryptedKey,
      keyMask,
      validated: 1,
      lastValidatedAt: now,
    });
  }

  return NextResponse.json({
    configured: true,
    keyMask,
    validated: true,
    lastValidatedAt: now.getTime(),
  });
}

export async function DELETE() {
  if (!isByoEnabled()) return comingSoonResponse();
  const auth = await requireAgencyUser();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: (auth as { code?: string }).code },
      { status: auth.status },
    );
  }
  await db
    .delete(schema.agencyAiConfigs)
    .where(eq(schema.agencyAiConfigs.agencyId, auth.agencyId));
  return NextResponse.json({ configured: false });
}
