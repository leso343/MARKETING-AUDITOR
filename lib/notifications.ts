/**
 * Server-side notification helpers — create in-app notifications for users.
 *
 * Usage:
 *   import { notify, notifyAgencyUsers } from "@/lib/notifications";
 *   await notify(userId, { type: "audit_complete", title: "Audit ready", message: "..." });
 *   await notifyAgencyUsers(agencyId, { type: "payment_issue", ... });
 */
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";
import type { NotificationType } from "@/db/schema";

interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * Create a notification for a single user. No-op when DB is unavailable.
 */
export async function notify(userId: string, input: NotificationInput): Promise<void> {
  if (!dbAvailable) return;
  try {
    await db.insert(schema.notifications).values({
      id: crypto.randomUUID(),
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl ?? null,
    });
  } catch (err) {
    log.error("Failed to create notification", err);
  }
}

/**
 * Create a notification for all users belonging to an agency.
 */
export async function notifyAgencyUsers(agencyId: string, input: NotificationInput): Promise<void> {
  if (!dbAvailable) return;
  try {
    const users = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.agencyId, agencyId));

    for (const user of users) {
      await notify(user.id, input);
    }
  } catch (err) {
    log.error("Failed to notify agency users", err);
  }
}

/**
 * Create a notification for all admin users.
 */
export async function notifyAdmins(input: NotificationInput): Promise<void> {
  if (!dbAvailable) return;
  try {
    const admins = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, "admin"));

    for (const admin of admins) {
      await notify(admin.id, input);
    }
  } catch (err) {
    log.error("Failed to notify admins", err);
  }
}
