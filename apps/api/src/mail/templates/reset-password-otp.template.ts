import { esc, font, heading, palette, paragraph, shell, strong } from 'notifier';

/**
 * Six-digit code, sent by PasswordResetService: `reset` for forgot-password,
 * `set` when a GitHub/Google user adds a first password from their account page.
 */
export interface ResetPasswordOtpTemplateInput {
  email: string;
  code: string;
  expiresMinutes: number;
  purpose?: 'reset' | 'set';
  appName?: string;
  supportEmail?: string;
}

export function resetPasswordOtpHtml({
  email,
  code,
  expiresMinutes,
  purpose = 'reset',
  appName = 'Warden',
  supportEmail,
}: ResetPasswordOtpTemplateInput): string {
  const set = purpose === 'set';
  const spaced = code.length === 6 ? `${code.slice(0, 3)}&nbsp;${code.slice(3)}` : esc(code);
  const body = [
    heading(set ? 'Add a password to your account' : 'Reset your password'),
    paragraph(
      set
        ? `Enter this code on your account page to add a password. It expires in ${strong(`${expiresMinutes} minutes`)}.`
        : `Enter this code on the reset screen to choose a new password. It expires in ${strong(`${expiresMinutes} minutes`)}.`,
    ),
    `<tr><td style="padding:0 0 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${palette.panel}" style="background:${palette.panel};border:1px solid ${palette.border};border-radius:14px;"><tr><td align="center" style="padding:22px 18px;font-family:${font.mono};font-size:32px;line-height:40px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:6px;color:${palette.text};">${spaced}</td></tr></table></td></tr>`,
    `<tr><td style="font-family:${font.heading};font-size:14px;line-height:20px;mso-line-height-rule:exactly;font-weight:700;color:${palette.danger};padding:0 0 6px 0;">!&nbsp;&nbsp;Never share this code</td></tr>`,
    paragraph(
      set
        ? `${appName} will never ask for it. If you didn't ask to add a password, someone may be signed in as you: sign out of other devices from your account page.`
        : `${appName} will never ask for it. If you didn't request a reset, your password hasn't changed and you can ignore this email.`,
      0,
    ),
  ].join('\n');

  return shell({
    title: set ? `Your ${appName} code to add a password` : `Your ${appName} reset code`,
    preheader: `Your ${set ? 'code' : 'password reset code'} is ${code}. It expires in ${expiresMinutes} minutes.`,
    body,
    reason: set
      ? `You received this because someone signed in as ${esc(email)} asked to add a password.`
      : `You received this because a password reset was requested for ${esc(email)}.`,
    appName,
    supportEmail,
  });
}
