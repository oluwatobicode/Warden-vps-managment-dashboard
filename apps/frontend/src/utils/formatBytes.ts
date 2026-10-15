/** 2_200_000_000 → "2.2 GB". Decimal units, like Docker and disk vendors. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "kB", "MB", "GB", "TB", "PB"];
  let n = Math.max(0, bytes);
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  const digits = i === 0 || n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${Number(n.toFixed(digits))} ${units[i]}`;
}
