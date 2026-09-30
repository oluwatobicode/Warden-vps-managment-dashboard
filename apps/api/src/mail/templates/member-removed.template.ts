import { badge, bulletList, detailsPanel, esc, formatDateTime, heading, palette, paragraph, shell, strong } from './layout';

/**
 * Copy states only what removal actually does today: the membership is
 * suspended and every session for the user is destroyed. Nothing here about
 * SSH keys or API tokens — those are org-owned, not user-owned, and are not
 * touched by removal.
 */
export interface MemberRemovedTemplateInput {
  memberEmail: string;
  organizationName: string;
  removedByName: string;
  removedByEmail: string;
  previousRoleLabel: string;
  removedAt: Date;
  appName?: string;
  supportEmail?: string;
}

export function memberRemovedHtml({
  memberEmail,
  organizationName,
  removedByName,
  removedByEmail,
  previousRoleLabel,
  removedAt,
  appName = 'Warden',
  supportEmail,
}: MemberRemovedTemplateInput): string {
  const org = esc(organizationName);
  const actor = esc(removedByName);
  const body = [
    badge('&#215;&nbsp;&nbsp;Access removed', palette.danger),
    heading(`You've been removed from ${org}`),
    paragraph(
      `${strong(actor)} removed your account from the ${org} workspace. Access ended immediately.`,
    ),
    detailsPanel([
      ['Workspace', org],
      ['Previous role', esc(previousRoleLabel)],
      ['Removed by', actor],
      ['Date', formatDateTime(removedAt)],
    ]),
    `<tr><td style="font-family:'Schibsted Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;mso-line-height-rule:exactly;font-weight:700;color:${palette.text};padding:0 0 10px 0;">What changes</td></tr>`,
    bulletList([
      'You are signed out of this workspace on every device.',
      'You can no longer view or deploy its projects.',
      'If you are invited again, your account is reactivated with the same email.',
    ]),
    `<tr><td style="font-family:'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;mso-line-height-rule:exactly;color:${palette.muted};padding:14px 0 0 0;">Think this was a mistake? Contact <a href="mailto:${esc(removedByEmail)}" style="color:${palette.link};text-decoration:none;">${esc(removedByEmail)}</a>.</td></tr>`,
  ].join('\n');

  return shell({
    title: `Your access to ${org} was removed`,
    preheader: `${actor} removed you from the ${org} workspace on ${appName}. Access ended immediately.`,
    body,
    reason: `You received this because your membership in ${org} changed (${esc(memberEmail)}).`,
    appName,
    supportEmail,
  });
}
