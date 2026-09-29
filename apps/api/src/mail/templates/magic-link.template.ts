/**
 * Magic-link email, dark theme. Layout follows the Postmark transactional
 * template (centred card, single CTA, plain-URL fallback, muted footer).
 *
 * Email-client rules baked in:
 *  - tables + inline styles only (no <style> reliance, no flex/grid)
 *  - every colour set explicitly on every block, so Gmail/Outlook "dark mode"
 *    can't invert it into something unreadable
 *  - system font stack, no web fonts
 *  - `color-scheme` meta so Apple Mail/iOS respect the dark palette
 */

const palette = {
  page: '#0b0f14',
  card: '#151b23',
  border: '#232b36',
  text: '#e6edf3',
  muted: '#8b98a5',
  faint: '#5c6773',
  accent: '#3b82f6',
  accentText: '#ffffff',
};

const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface MagicLinkTemplateInput {
  url: string;
  expiresMinutes: number;
  appName?: string;
  supportEmail?: string;
}

export function magicLinkHtml({
  url,
  expiresMinutes,
  appName = 'Warden',
  supportEmail,
}: MagicLinkTemplateInput): string {
  const year = new Date().getFullYear();
  const support = supportEmail
    ? `<a href="mailto:${supportEmail}" style="color:${palette.accent};text-decoration:underline;">contact support</a>`
    : 'contact support';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Sign in to ${appName}</title>
</head>
<body style="margin:0;padding:0;background-color:${palette.page};">
  <!-- Preheader: shows in the inbox preview, hidden in the body -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${palette.page};">
    Your ${appName} sign-in link. Expires in ${expiresMinutes} minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${palette.page};">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Logo / wordmark -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 24px;font-family:${font};font-size:20px;font-weight:700;color:${palette.text};">
              ${appName}
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${palette.card};border:1px solid ${palette.border};border-radius:12px;">
          <tr>
            <td style="padding:40px 40px 32px;font-family:${font};color:${palette.text};">

              <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:${palette.text};">
                Sign in to ${appName}
              </h1>

              <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:${palette.muted};">
                Click the button below to sign in. This link expires in
                <strong style="color:${palette.text};">${expiresMinutes} minutes</strong>
                and can only be used once.
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${palette.accent};">
                    <a href="${url}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-family:${font};font-size:16px;font-weight:600;line-height:20px;color:${palette.accentText};text-decoration:none;border-radius:8px;">
                      Sign in to ${appName}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:15px;line-height:24px;color:${palette.muted};">
                If you didn't request this email, you can safely ignore it.
                Someone may have typed your address by mistake.
              </p>

              <p style="margin:0;font-size:15px;line-height:24px;color:${palette.muted};">
                Having trouble? ${support} and we'll sort it out.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 20px;">
                <tr><td style="height:1px;background-color:${palette.border};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <!-- Plain URL fallback -->
              <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${palette.faint};">
                If the button above doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;">
                <a href="${url}" style="color:${palette.accent};text-decoration:underline;">${url}</a>
              </p>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:24px 16px 0;font-family:${font};font-size:13px;line-height:20px;color:${palette.faint};">
              &copy; ${year} ${appName}. All rights reserved.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
