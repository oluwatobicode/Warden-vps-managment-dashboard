export const palette = {
  page: '#080808',
  card: '#0c0c0c',
  panel: '#0f0f0f',
  border: '#1f1f1f',
  divider: '#1a1a1a',
  text: '#fafafa',
  body: '#e4e4e7',
  muted: '#a1a1aa',
  faint: '#71717a',
  fainter: '#52525b',
  link: '#60a5fa',
  button: '#fafafa',
  buttonText: '#0a0a0a',
  success: '#22c55e',
  danger: '#f87171',
} as const;

// System stacks only. Email clients rarely load web fonts (Gmail never does),
// so naming one just means designing for a face almost nobody sees.
export const font = {
  heading:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif",
  body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif",
  mono: "SFMono-Regular,Menlo,Consolas,'Courier New',monospace",
} as const;

const LH = 'mso-line-height-rule:exactly;';

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function heading(text: string): string {
  return `<tr><td style="font-family:${font.heading};font-size:26px;line-height:32px;${LH}font-weight:700;letter-spacing:-0.5px;color:${palette.text};padding:0 0 12px 0;">${text}</td></tr>`;
}

export function paragraph(html: string, padBottom = 20): string {
  return `<tr><td style="font-family:${font.body};font-size:15px;line-height:24px;${LH}color:${palette.muted};padding:0 0 ${padBottom}px 0;">${html}</td></tr>`;
}

export function strong(html: string): string {
  return `<strong style="color:${palette.body};">${html}</strong>`;
}

/** Small pill above the heading, e.g. "✓  Workspace ready". */
export function badge(text: string, color: string): string {
  return `<tr><td style="padding:0 0 14px 0;"><span style="display:inline-block;padding:4px 10px;border:1px solid ${palette.border};border-radius:999px;font-family:${font.body};font-size:12px;line-height:16px;${LH}font-weight:600;color:${color};">${text}</span></td></tr>`;
}

/** Bulletproof button: VML for Outlook, anchor everywhere else. */
export function button(label: string, url: string): string {
  const safeUrl = esc(url);
  return `<tr><td style="padding:6px 0 26px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${palette.button}" style="border-radius:12px;background:${palette.button};">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:46px;v-text-anchor:middle;width:220px;" arcsize="26%" fillcolor="${palette.button}" stroke="f"><center style="color:${palette.buttonText};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${safeUrl}" target="_blank" style="display:block;padding:14px 26px;font-family:${font.body};font-size:14px;line-height:18px;${LH}font-weight:700;color:${palette.buttonText};text-decoration:none;border-radius:12px;">${label}</a><!--<![endif]-->
</td></tr></table></td></tr>`;
}

/** Plain-URL fallback under a button. */
export function urlFallback(url: string): string {
  const safeUrl = esc(url);
  return `<tr><td style="font-family:${font.body};font-size:12px;line-height:18px;${LH}color:${palette.faint};padding:0 0 6px 0;">Button not working? Paste this into your browser:</td></tr>
<tr><td style="font-family:${font.mono};font-size:11px;line-height:17px;${LH}color:${palette.link};padding:0 0 4px 0;word-break:break-all;"><a href="${safeUrl}" style="color:${palette.link};text-decoration:none;">${safeUrl}</a></td></tr>`;
}

/** Two-column key/value list inside a bordered panel. */
export function detailsPanel(
  rows: Array<[label: string, value: string]>,
): string {
  const body = rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:${i === 0 ? 14 : 8}px 18px ${i === rows.length - 1 ? 14 : 8}px 18px;font-family:${font.body};font-size:13px;line-height:20px;${LH}color:${palette.faint};width:40%;">${k}</td><td style="padding:${i === 0 ? 14 : 8}px 18px ${i === rows.length - 1 ? 14 : 8}px 0;font-family:${font.body};font-size:13px;line-height:20px;${LH}color:${palette.body};">${v}</td></tr>`,
    )
    .join('');
  return `<tr><td style="padding:0 0 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${palette.panel}" style="background:${palette.panel};border:1px solid ${palette.border};border-radius:14px;">${body}</table></td></tr>`;
}

/** Highlighted single-line panel (role name, OTP code). */
export function featurePanel(title: string, subtitle?: string): string {
  return `<tr><td style="padding:0 0 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${palette.panel}" style="background:${palette.panel};border:1px solid ${palette.border};border-radius:14px;"><tr><td style="padding:18px 18px ${subtitle ? 6 : 18}px 18px;font-family:${font.heading};font-size:16px;line-height:22px;${LH}font-weight:700;color:${palette.text};">${title}</td></tr>${
    subtitle
      ? `<tr><td style="padding:0 18px 16px 18px;font-family:${font.body};font-size:13px;line-height:20px;${LH}color:${palette.muted};">${subtitle}</td></tr>`
      : ''
  }</table></td></tr>`;
}

export function bulletList(items: string[]): string {
  return items
    .map(
      (i) =>
        `<tr><td style="font-family:${font.body};font-size:14px;line-height:22px;${LH}color:${palette.muted};padding:0 0 6px 0;">&bull;&nbsp;&nbsp;${i}</td></tr>`,
    )
    .join('');
}

// ─── Page shell ─────────────────────────────────────────────────────────────

export interface ShellInput {
  title: string;
  /** Inbox preview text. Keep under ~90 chars. */
  preheader: string;
  /** Rows (<tr>) for the inside of the card. */
  body: string;
  /** "You received this because …" */
  reason: string;
  appName?: string;
  /** Rendered as a "Reply to this email" line only when set. */
  supportEmail?: string;
}

export function shell({
  title,
  preheader,
  body,
  reason,
  appName = 'Warden',
  supportEmail,
}: ShellInput): string {
  const year = new Date().getFullYear();
  // Padding so the inbox preview doesn't spill into the body text.
  const pad = '&#8199;&#65279;&#847;'.repeat(6);
  const support = supportEmail
    ? `<br>Questions? <a href="mailto:${esc(supportEmail)}" style="color:${palette.muted};text-decoration:underline;">${esc(supportEmail)}</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${title}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0!important;padding:0!important;background:${palette.page};}
a{color:${palette.link};}
@media (max-width:620px){.wrap{width:100%!important}.card{padding:28px 22px 24px!important}.outer{padding:36px 12px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${palette.page};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${palette.page};opacity:0;">${preheader}${pad}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${palette.page}" style="background:${palette.page};">
<tr><td class="outer" align="center" valign="top" bgcolor="${palette.page}" style="background-color:${palette.page};padding:56px 16px 48px 16px;">
<table class="wrap" role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:560px;">
<tr><td align="center" style="padding:0 0 28px 0;">
<div style="font-family:${font.heading};font-size:14px;line-height:16px;${LH}font-weight:800;letter-spacing:0.84px;color:${palette.text};">${appName.toUpperCase()}</div>
<div style="font-family:${font.body};font-size:9px;line-height:12px;${LH}letter-spacing:0.8px;color:#8b8b93;">DEPLOY CONTROL PLANE</div>
</td></tr>
<tr><td class="card" bgcolor="${palette.card}" style="background:${palette.card};border:1px solid ${palette.border};border-radius:20px;padding:40px 40px 34px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${body}
</table>
</td></tr>
<tr><td align="center" style="padding:26px 24px 0 24px;font-family:${font.body};font-size:12px;line-height:19px;${LH}color:${palette.faint};">${reason}${support}</td></tr>
<tr><td align="center" style="padding:14px 24px 0 24px;font-family:${font.body};font-size:11px;line-height:17px;${LH}color:${palette.fainter};">&copy; ${year} ${appName}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
