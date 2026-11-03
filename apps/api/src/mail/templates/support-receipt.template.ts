import { badge, detailsPanel, esc, font, heading, palette, paragraph, shell } from 'notifier';

/** The copy the sender gets: we have it, and replies come to this address. */
export interface SupportReceiptTemplateInput {
  name: string;
  email: string;
  categoryLabel: string;
  subject: string;
  message: string;
  appName?: string;
  supportEmail?: string;
}

export function supportReceiptHtml(p: SupportReceiptTemplateInput): string {
  const body = [
    badge('&#10003;&nbsp;&nbsp;Message received', palette.success),
    heading('We got your message'),
    paragraph(
      `Thanks${p.name ? `, ${esc(p.name)}` : ''}. We read every message and will reply to ${esc(p.email)}. Here's a copy of what you sent.`,
    ),
    detailsPanel([
      ['Type', esc(p.categoryLabel)],
      ['Subject', esc(p.subject)],
    ]),
    `<tr><td style="padding:0 0 8px 0;font-family:${font.body};font-size:14px;line-height:22px;color:${palette.muted};white-space:pre-wrap;">${esc(p.message)}</td></tr>`,
  ].join('\n');

  return shell({
    title: 'We got your message',
    preheader: `We'll reply to ${p.email} about "${p.subject}".`,
    body,
    reason: `You received this because you sent a message from ${p.appName ?? 'Warden'}'s Support form.`,
    appName: p.appName,
    supportEmail: p.supportEmail,
  });
}
