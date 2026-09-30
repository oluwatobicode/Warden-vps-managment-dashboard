import { badge, button, detailsPanel, esc, formatDate, formatDateTime, heading, palette, paragraph, shell, strong } from './layout';

/** Sent to the inviter when their invite is accepted. */
export interface InviteAcceptedTemplateInput {
  memberName: string;
  memberEmail: string;
  organizationName: string;
  roleLabel: string;
  invitedAt: Date;
  joinedAt: Date;
  teamSize: number;
  manageTeamUrl: string;
  appName?: string;
  supportEmail?: string;
}

export function inviteAcceptedHtml({
  memberName,
  memberEmail,
  organizationName,
  roleLabel,
  invitedAt,
  joinedAt,
  teamSize,
  manageTeamUrl,
  appName = 'Warden',
  supportEmail,
}: InviteAcceptedTemplateInput): string {
  const org = esc(organizationName);
  const name = esc(memberName);
  const body = [
    badge('&#10003;&nbsp;&nbsp;Invite accepted', palette.success),
    heading(`${name} joined ${org}`),
    paragraph(
      `The invite you sent on ${strong(formatDate(invitedAt))} was accepted. Their access is active now.`,
    ),
    detailsPanel([
      ['Member', `${name}<br><span style="color:${palette.faint};">${esc(memberEmail)}</span>`],
      ['Role', esc(roleLabel)],
      ['Joined', formatDateTime(joinedAt)],
      ['Team size', `${teamSize} member${teamSize === 1 ? '' : 's'}`],
    ]),
    button('Manage team', manageTeamUrl),
    paragraph('Roles can be changed or access removed from Team settings at any time.', 0),
  ].join('\n');

  return shell({
    title: `${name} accepted your invite`,
    preheader: `${name} joined ${org} as ${roleLabel}. You can change their role any time.`,
    body,
    reason: `You received this because you invited ${esc(memberEmail)} to ${org}.`,
    appName,
    supportEmail,
  });
}
