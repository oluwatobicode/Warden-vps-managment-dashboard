import { badge, detailsPanel, esc, formatDateTime, font, heading, palette, shell } from 'notifier';

/** What lands in the support inbox. Reply-To is the sender, so "Reply" answers them. */
export interface SupportRequestTemplateInput {
  categoryLabel: string;
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
  organizationName: string;
  roleLabel: string;
  page?: string;
  userAgent?: string;
  screenshots: number;
  sentAt: Date;
  appName?: string;
  supportEmail?: string;
}

export function supportRequestHtml(p: SupportRequestTemplateInput): string {
  const body = [
    badge(esc(p.categoryLabel), p.categoryLabel === 'Bug' ? palette.danger : palette.muted),
    heading(esc(p.subject)),
    // The message as typed: escaped, line breaks kept.
    `<tr><td style="padding:0 0 24px 0;font-family:${font.body};font-size:15px;line-height:24px;color:${palette.body};white-space:pre-wrap;">${esc(p.message)}</td></tr>`,
    detailsPanel([
      ['From', `${esc(p.senderName)} &lt;${esc(p.senderEmail)}&gt;`],
      ['Organization', esc(p.organizationName)],
      ['Role', esc(p.roleLabel)],
      ['Page', p.page ? esc(p.page) : '—'],
      ['Browser', p.userAgent ? esc(p.userAgent) : '—'],
      ['Screenshots', p.screenshots ? `${p.screenshots} attached` : 'None'],
      ['Sent', formatDateTime(p.sentAt)],
    ]),
  ].join('\n');

  return shell({
    title: `[${p.categoryLabel}] ${p.subject}`,
    preheader: p.message.slice(0, 120),
    body,
    reason: `Sent from the Support form in ${p.appName ?? 'Warden'}. Reply to answer ${esc(p.senderEmail)} directly.`,
    appName: p.appName,
  });
}
