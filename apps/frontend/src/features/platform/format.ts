/** Small number formatters for the platform page. */

export const fmtInt = (n: number) => n.toLocaleString("en-US");

export function fmtPct(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 1000) / 10}%`;
}

/** 42 s, 3.5 min, 2.1 h, 4.3 d */
export function fmtSeconds(s: number | null): string {
  if (s === null) return "—";
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${(s / 60).toFixed(1)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
}

/** "Oct 28" from a YYYY-MM-DD UTC day. */
export function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** How a user signed up (User.authProcess). */
export const AUTH_LABEL: Record<"EMAIL" | "GITHUB" | "GOOGLE", string> = { EMAIL: "Email", GITHUB: "GitHub", GOOGLE: "Google" };
