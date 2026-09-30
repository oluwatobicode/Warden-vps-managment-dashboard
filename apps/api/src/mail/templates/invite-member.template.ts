import {
  button,
  esc,
  featurePanel,
  formatDate,
  heading,
  paragraph,
  shell,
  strong,
  urlFallback,
} from './layout';

/**
 * Shows the role *name* only. The permission boundary between roles is not
 * finalised (DEPLOYER vs DEV_OPS), so no permission copy is promised here.
 * Invitations are org-wide; there is no per-project scoping in the schema.
 */
export interface InviteMemberTemplateInput {
  inviteeEmail: string;
  inviterName: string;
  organizationName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresAt: Date;
  appName?: string;
  supportEmail?: string;
}

export function inviteMemberHtml({
  inviteeEmail,
  inviterName,
  organizationName,
  roleLabel,
  acceptUrl,
  expiresAt,
  appName = 'Warden',
  supportEmail,
}: InviteMemberTemplateInput): string {
  const org = esc(organizationName);
  const inviter = esc(inviterName);
  // Derived from the same date the body shows, so the two can never disagree.
  const daysLeft = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000),
  );
  const body = [
    heading(`Join ${org} on ${appName}`),
    paragraph(
      `${strong(inviter)} invited you to the ${org} workspace. You'll join with this role:`,
    ),
    featurePanel(esc(roleLabel)),
    button('Accept invite', acceptUrl),
    paragraph(
      `The invite expires on ${strong(formatDate(expiresAt))}. Not expecting it? Ignore this email and no account is created.`,
    ),
    urlFallback(acceptUrl),
  ].join('\n');

  return shell({
    title: `You're invited to ${org} on ${appName}`,
    preheader: `${inviter} invited you to join ${org} as ${roleLabel}. The invite expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
    body,
    reason: `You received this because ${inviter} invited ${esc(inviteeEmail)}.`,
    appName,
    supportEmail,
  });
}
