/**
 * AI assistant — usage tracking + tier limits.
 *
 * Tiers (per the user-facing pricing):
 *   - free   : 25 messages total during the 14-day trial (lifetime cap)
 *   - pro    : 500 messages per calendar month
 *   - agency : unlimited (soft cap of 100/day/seat enforced at the IP layer)
 *
 * Hourly throttle for all tiers: 30 messages/hour (handled by the
 * rate-limit lib at the API route, NOT here).
 */
import { db, schema, dbAvailable } from "@/lib/db";
import { and, eq, gte, count, sql } from "drizzle-orm";
import { PLANS, type PlanId } from "@/lib/plans";

export interface UsageState {
  ok: boolean;
  /** Human-readable reason when ok=false (shown in UI). */
  reason?: string;
  code?: "MONTHLY_CAP" | "TRIAL_CAP" | "DAILY_CAP";
  used: number;
  limit: number;
}

const FREE_TRIAL_TOTAL = 25;
const PRO_MONTHLY = 500;
const AGENCY_DAILY_PER_SEAT = 100;

/**
 * Count messages by a user in a time window. Counts `user` messages
 * only (assistant messages are responses to those, so counting user
 * messages = counting "conversations the user has consumed").
 */
async function countUserMessages(userId: string, sinceMs: number): Promise<number> {
  if (!dbAvailable) return 0;
  const rows = await db
    .select({ n: count() })
    .from(schema.aiMessages)
    .innerJoin(
      schema.aiConversations,
      eq(schema.aiMessages.conversationId, schema.aiConversations.id),
    )
    .where(
      and(
        eq(schema.aiConversations.userId, userId),
        eq(schema.aiMessages.role, "user"),
        gte(schema.aiMessages.createdAt, new Date(sinceMs)),
      ),
    );
  return rows[0]?.n ?? 0;
}

function startOfThisMonthMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function startOfTodayMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Check whether the user is allowed to send another AI message right now.
 * Returns ok=true with usage state, or ok=false with a UI-friendly reason.
 */
export async function checkAiUsage(userId: string, planId: PlanId): Promise<UsageState> {
  if (!dbAvailable) {
    return { ok: true, used: 0, limit: Number.POSITIVE_INFINITY };
  }

  // Agency: daily soft cap per user
  if (planId === "agency") {
    const used = await countUserMessages(userId, startOfTodayMs());
    if (used >= AGENCY_DAILY_PER_SEAT) {
      return {
        ok: false,
        code: "DAILY_CAP",
        reason: `Daily fair-use cap reached (${AGENCY_DAILY_PER_SEAT}/day). Resets at midnight UTC.`,
        used,
        limit: AGENCY_DAILY_PER_SEAT,
      };
    }
    return { ok: true, used, limit: AGENCY_DAILY_PER_SEAT };
  }

  // Pro: monthly cap
  if (planId === "pro") {
    const used = await countUserMessages(userId, startOfThisMonthMs());
    if (used >= PRO_MONTHLY) {
      return {
        ok: false,
        code: "MONTHLY_CAP",
        reason: `Monthly limit reached (${PRO_MONTHLY}/mo). Upgrade to Agency for unlimited.`,
        used,
        limit: PRO_MONTHLY,
      };
    }
    return { ok: true, used, limit: PRO_MONTHLY };
  }

  // Free: lifetime trial cap (no time window — sinceMs=0 counts everything)
  const used = await countUserMessages(userId, 0);
  if (used >= FREE_TRIAL_TOTAL) {
    return {
      ok: false,
      code: "TRIAL_CAP",
      reason: `Free trial AI cap reached (${FREE_TRIAL_TOTAL} messages). Upgrade to Pro for 500/month.`,
      used,
      limit: FREE_TRIAL_TOTAL,
    };
  }
  return { ok: true, used, limit: FREE_TRIAL_TOTAL };
}

/** Human-readable label for the user's tier limit (used in UI footer). */
export function describeTierLimit(planId: PlanId): string {
  const plan = PLANS[planId];
  if (planId === "free") return `${FREE_TRIAL_TOTAL} messages during trial`;
  if (planId === "pro") return `${PRO_MONTHLY} messages / month on ${plan.label}`;
  return `Unlimited (${AGENCY_DAILY_PER_SEAT}/day fair use) on ${plan.label}`;
}
