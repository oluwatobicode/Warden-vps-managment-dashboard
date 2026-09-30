import { badge, button, esc, font, heading, palette, paragraph, shell, strong } from './layout';

export interface WelcomeTemplateInput {
  firstName: string;
  organizationName: string;
  consoleUrl: string;
  appName?: string;
  supportEmail?: string;
}

const steps: Array<[string, string]> = [
  ['Add an SSH key', 'Generate one in Warden or paste an existing public key.'],
  ['Connect a server', 'Point Warden at any VPS. The connection is tested before it is saved.'],
  ['Deploy an app', 'Link a Git repo. Every deploy waits on a health check before traffic moves.'],
];

function stepRows(): string {
  return steps
    .map(
      ([title, desc], i) => `<tr>
<td width="32" valign="top" style="padding:0 0 18px 0;"><div style="width:24px;height:24px;border-radius:999px;border:1px solid ${palette.border};font-family:${font.heading};font-size:12px;line-height:24px;mso-line-height-rule:exactly;font-weight:700;color:${palette.text};text-align:center;">${i + 1}</div></td>
<td valign="top" style="padding:0 0 18px 0;"><div style="font-family:${font.heading};font-size:15px;line-height:22px;mso-line-height-rule:exactly;font-weight:700;color:${palette.text};">${title}</div><div style="font-family:${font.body};font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${palette.muted};">${desc}</div></td>
</tr>`,
    )
    .join('');
}

export function welcomeHtml({
  firstName,
  organizationName,
  consoleUrl,
  appName = 'Warden',
  supportEmail,
}: WelcomeTemplateInput): string {
  const org = esc(organizationName);
  const body = [
    badge('&#10003;&nbsp;&nbsp;Workspace ready', palette.success),
    heading(`Welcome to ${appName}, ${esc(firstName)}`),
    paragraph(
      `${strong(org)} is set up. Three steps get you from an empty console to a live deploy.`,
    ),
    `<tr><td style="padding:4px 0 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${stepRows()}</table></td></tr>`,
    button('Open your console', consoleUrl),
  ].join('\n');

  return shell({
    title: `Welcome to ${appName}`,
    preheader: 'Your workspace is ready. Connect a server and ship your first deploy.',
    body,
    reason: `You received this because you created a ${appName} workspace.`,
    appName,
    supportEmail,
  });
}
