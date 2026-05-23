/**
 * Server component wrapper for DowngradeWarning.
 *
 * Fetches the current user's subscription status and passes it to the
 * client-side DowngradeWarning component. Renders nothing when:
 *   - Auth is disabled (single-tenant mode)
 *   - User is not logged in
 *   - Subscription is active/trialing (healthy)
 */
import { auth, authEnabled } from "@/auth";
import { dbAvailable, db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import DowngradeWarning, { type WarningStatus } from "./DowngradeWarning";

const WARN_STATUSES = new Set(["past_due", "canceled", "incomplete"]);

export default async function SubscriptionBanner() {
  if (!authEnabled || !dbAvailable) return null;

  try {
    const session = await auth();
    if (!session?.user?.agencyId) return null;

    const subs = await db
      .select({ status: schema.subscriptions.status })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.agencyId, session.user.agencyId))
      .limit(1);

    const status = subs[0]?.status ?? null;
    if (!status || !WARN_STATUSES.has(status)) return null;

    return <DowngradeWarning status={status as WarningStatus} />;
  } catch {
    // Don't let subscription check errors break the layout
    return null;
  }
}
