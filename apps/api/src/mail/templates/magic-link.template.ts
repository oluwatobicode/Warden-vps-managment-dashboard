import { button, esc, heading, paragraph, shell, strong, urlFallback } from './layout';

/**
 * One email covers both sign-in and sign-up: the /auth/magic-link route
 * doesn't know (and must not reveal) whether the address has an account, so
 * the copy is written to be true either way.
 */
export interface MagicLinkTemplateInput {
  url: string;
  email: string;
  expiresMinutes: number;
  appName?: string;
  supportEmail?: string;
}

export function magicLinkHtml({
  url,
  email,
  expiresMinutes,
  appName = 'Warden',
  supportEmail,
}: MagicLinkTemplateInput): string {
  const body = [
    heading(`Sign in to ${appName}`),
    paragraph(
      `Use the button below to continue to ${appName}. The link expires in ${strong(`${expiresMinutes} minutes`)} and can only be used once.`,
    ),
    button(`Sign in to ${appName}`, url),
    paragraph(
      `Didn't request this? You can ignore this email. Nobody can sign in without the link, and no account is created until it is used.`,
    ),
    urlFallback(url),
  ].join('\n');

  return shell({
    title: `Sign in to ${appName}`,
    preheader: `Your ${appName} sign-in link. It expires in ${expiresMinutes} minutes and works once.`,
    body,
    reason: `You received this because someone requested a sign-in link for ${esc(email)}.`,
    appName,
    supportEmail,
  });
}
