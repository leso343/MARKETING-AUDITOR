/**
 * Email sending — Resend integration with deploy-safe fallback.
 *
 * When RESEND_API_KEY is set, emails are sent via Resend's HTTP API.
 * When unset, emails are logged to the server console (dev/admin relay).
 *
 * Uses the native fetch API — no additional dependencies required.
 *
 * Usage:
 *   import { sendEmail, emailEnabled } from "@/lib/email";
 *   await sendEmail({
 *     to: "user@example.com",
 *     subject: "Hello",
 *     html: "<p>Hi</p>",
 *     text: "Hi",
 *   });
 */
import { log } from "@/lib/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? "Blank Page Audits <noreply@blankpageaudits.com>";

/** True when email sending is configured (Resend API key is set). */
export const emailEnabled = !!RESEND_API_KEY;

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend. Falls back to console logging when unconfigured.
 *
 * Returns { success: true, id } on success or { success: false, error } on failure.
 * Never throws — callers can fire-and-forget.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    // Dev fallback: log a metadata line ONLY.
    //
    // NEW-M-27 fix: do NOT include the email body or preview here.
    // Templates like password-reset embed a single-use token in the
    // plain-text body, and logging even a snippet leaks it into any
    // server-log sink that retains structured fields.
    log.info("Email (dev mode — RESEND_API_KEY not set)", {
      to: payload.to,
      subject: payload.subject,
      bodyBytes: payload.html.length,
    });
    return { success: true, id: "dev-console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("Resend API error", { status: res.status, body });
      return { success: false, error: `Resend returned ${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    log.info("Email sent", { to: payload.to, subject: payload.subject, id: data.id });
    return { success: true, id: data.id };
  } catch (err) {
    log.error("Email send failed", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}
