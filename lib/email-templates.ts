/**
 * Styled HTML email templates for transactional emails.
 *
 * All templates use inline CSS for maximum email-client compatibility.
 * Design matches the Blank Page Audits brand: dark bg (#030303), red accent (#ff0000),
 * mono typography for labels.
 */

const BRAND = {
  name: "Blank Page Audits",
  color: "#ff0000",
  bg: "#030303",
  card: "#0a0a0a",
  border: "#1a1a1a",
  text: "#ffffff",
  textDim: "#a0a0a0",
  fontMain: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${BRAND.name}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.fontMain};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <div style="display:inline-block;font-family:${BRAND.fontMono};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.textDim};">
                &gt; ${BRAND.name}
              </div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:${BRAND.card};border:1px solid ${BRAND.border};padding:40px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:${BRAND.fontMono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.textDim};">
                Forensic Ad Intelligence
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:${BRAND.textDim};">
                You received this because your account is registered with ${BRAND.name}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Password Reset Email ────────────────────────────────────────────────────

export function passwordResetEmail(resetUrl: string, expiresInMinutes = 60): { subject: string; html: string; text: string } {
  const subject = `Reset your ${BRAND.name} password`;

  const html = baseLayout(`
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:rgba(255,0,0,0.1);text-align:center;font-size:24px;">
        &#128274;
      </div>
    </div>

    <h1 style="margin:0 0 8px;font-family:${BRAND.fontMain};font-size:22px;font-weight:700;color:${BRAND.text};text-align:center;letter-spacing:-0.5px;">
      Password Reset
    </h1>

    <p style="margin:0 0 24px;font-family:${BRAND.fontMono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.textDim};text-align:center;">
      Secure account recovery
    </p>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.textDim};">
      We received a request to reset the password for your account. Click the button below to choose a new password.
    </p>

    <!-- CTA Button -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" target="_blank" style="display:inline-block;background:${BRAND.color};color:#ffffff;font-family:${BRAND.fontMono};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 32px;line-height:1;">
        Reset Password
      </a>
    </div>

    <!-- Expiry notice -->
    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-family:${BRAND.fontMono};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${BRAND.textDim};">
        &#9200; This link expires in ${expiresInMinutes} minutes
      </p>
    </div>

    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${BRAND.textDim};">
      If you didn't request this, you can safely ignore this email. Your password won't change.
    </p>

    <!-- Fallback URL -->
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid ${BRAND.border};">
      <p style="margin:0 0 6px;font-family:${BRAND.fontMono};font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${BRAND.textDim};">
        Button not working? Copy and paste this URL:
      </p>
      <p style="margin:0;font-size:12px;word-break:break-all;color:${BRAND.color};">
        ${resetUrl}
      </p>
    </div>
  `);

  const text = `Reset your ${BRAND.name} password

We received a request to reset the password for your account.

Reset your password: ${resetUrl}

This link expires in ${expiresInMinutes} minutes.

If you didn't request this, you can safely ignore this email.

— ${BRAND.name}`;

  return { subject, html, text };
}

// ─── Welcome / Onboarding Email ──────────────────────────────────────────────

export function welcomeEmail(userName: string, loginUrl: string): { subject: string; html: string; text: string } {
  const subject = `Welcome to ${BRAND.name}`;

  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-family:${BRAND.fontMain};font-size:22px;font-weight:700;color:${BRAND.text};text-align:center;letter-spacing:-0.5px;">
      Welcome, ${userName}
    </h1>

    <p style="margin:0 0 24px;font-family:${BRAND.fontMono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.textDim};text-align:center;">
      Your forensic audit engine is ready
    </p>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.textDim};">
      Your account has been created. Here's how to get started:
    </p>

    <!-- Steps -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;vertical-align:top;">
              <div style="width:24px;height:24px;line-height:24px;border-radius:50%;background:rgba(255,0,0,0.15);text-align:center;font-family:${BRAND.fontMono};font-size:11px;font-weight:700;color:${BRAND.color};">1</div>
            </td>
            <td style="padding-left:12px;font-size:13px;color:${BRAND.text};line-height:1.5;">
              <strong>Create a client</strong><br/>
              <span style="color:${BRAND.textDim};">Name the business you're auditing.</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;vertical-align:top;">
              <div style="width:24px;height:24px;line-height:24px;border-radius:50%;background:rgba(255,0,0,0.15);text-align:center;font-family:${BRAND.fontMono};font-size:11px;font-weight:700;color:${BRAND.color};">2</div>
            </td>
            <td style="padding-left:12px;font-size:13px;color:${BRAND.text};line-height:1.5;">
              <strong>Upload Meta Ads CSVs</strong><br/>
              <span style="color:${BRAND.textDim};">Export from Ads Manager and drop them in.</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;vertical-align:top;">
              <div style="width:24px;height:24px;line-height:24px;border-radius:50%;background:rgba(255,0,0,0.15);text-align:center;font-family:${BRAND.fontMono};font-size:11px;font-weight:700;color:${BRAND.color};">3</div>
            </td>
            <td style="padding-left:12px;font-size:13px;color:${BRAND.text};line-height:1.5;">
              <strong>Get your audit</strong><br/>
              <span style="color:${BRAND.textDim};">Forensic analysis with actionable insights in seconds.</span>
            </td>
          </tr></table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${loginUrl}" target="_blank" style="display:inline-block;background:${BRAND.color};color:#ffffff;font-family:${BRAND.fontMono};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 32px;line-height:1;">
        Get Started
      </a>
    </div>
  `);

  const text = `Welcome to ${BRAND.name}, ${userName}!

Your forensic audit engine is ready. Here's how to get started:

1. Create a client — Name the business you're auditing.
2. Upload Meta Ads CSVs — Export from Ads Manager and drop them in.
3. Get your audit — Forensic analysis with actionable insights in seconds.

Sign in: ${loginUrl}

— ${BRAND.name}`;

  return { subject, html, text };
}

// ─── Payment Issue Email ─────────────────────────────────────────────────────

export function paymentIssueEmail(portalUrl: string): { subject: string; html: string; text: string } {
  const subject = `Action needed: Payment issue on your ${BRAND.name} account`;

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:rgba(245,158,11,0.15);text-align:center;font-size:24px;">
        &#9888;&#65039;
      </div>
    </div>

    <h1 style="margin:0 0 8px;font-family:${BRAND.fontMain};font-size:22px;font-weight:700;color:${BRAND.text};text-align:center;letter-spacing:-0.5px;">
      Payment Issue
    </h1>

    <p style="margin:0 0 24px;font-family:${BRAND.fontMono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgb(245,158,11);text-align:center;">
      Action required
    </p>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.textDim};">
      We were unable to process your most recent payment. Please update your billing information to continue using ${BRAND.name} without interruption.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${portalUrl}" target="_blank" style="display:inline-block;background:${BRAND.color};color:#ffffff;font-family:${BRAND.fontMono};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 32px;line-height:1;">
        Update Billing
      </a>
    </div>

    <p style="margin:0;font-size:13px;color:${BRAND.textDim};">
      If you've already resolved this, you can disregard this email.
    </p>
  `);

  const text = `Payment issue on your ${BRAND.name} account

We were unable to process your most recent payment. Please update your billing information:

${portalUrl}

— ${BRAND.name}`;

  return { subject, html, text };
}
