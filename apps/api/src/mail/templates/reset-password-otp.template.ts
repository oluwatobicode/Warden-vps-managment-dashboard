import { esc, font, heading, palette, paragraph, shell, strong } from './layout';

/**
 * Six-digit reset code. The template is ready; the reset flow that issues
 * and verifies the code does not exist yet, so nothing calls this until it does.
 */
export interface ResetPasswordOtpTemplateInput {
  email: string;
  code: string;
  expiresMinutes: number;
  appName?: string;
  supportEmail?: string;
}

export function resetPasswordOtpHtml({
  email,
  code,
  expiresMinutes,
  appName = 'Warden',
  supportEmail,
}: ResetPasswordOtpTemplateInput): string {
  const spaced = code.length === 6 ? `${code.slice(0, 3)}&nbsp;${code.slice(3)}` : esc(code);
  const body = [
    heading('Reset your password'),
    paragraph(
      `Enter this code on the reset screen to choose a new password. It expires in ${strong(`${expiresMinutes} minutes`)}.`,
    ),
    `<tr><td style="padding:0 0 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${palette.panel}" style="background:${palette.panel};border:1px solid ${palette.border};border-radius:14px;"><tr><td align="center" style="padding:22px 18px;font-family:${font.mono};font-size:32px;line-height:40px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:6px;color:${palette.text};">${spaced}</td></tr></table></td></tr>`,
    `<tr><td style="font-family:${font.heading};font-size:14px;line-height:20px;mso-line-height-rule:exactly;font-weight:700;color:${palette.danger};padding:0 0 6px 0;">!&nbsp;&nbsp;Never share this code</td></tr>`,
    paragraph(
      `${appName} will never ask for it. If you didn't request a reset, your password hasn't changed and you can ignore this email.`,
      0,
    ),
  ].join('\n');

  return shell({
    title: `Your ${appName} reset code`,
    preheader: `Your password reset code is ${code}. It expires in ${expiresMinutes} minutes.`,
    body,
    reason: `You received this because a password reset was requested for ${esc(email)}.`,
    appName,
    supportEmail,
  });
}
