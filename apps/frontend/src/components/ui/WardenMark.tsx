/**
 * The Warden mark: pills, beads and the bridges between them, one shape each
 * (they overlap, so they stay separate paths). Drawn in currentColor.
 */
const MARK_PATHS = [
  "M0.5 136.5a136 136 0 0 1 272 0V543a136 136 0 0 1 -272 0Z",
  "M544.5 136.5a136 136 0 0 1 272 0V543a136 136 0 0 1 -272 0Z",
  "M1088.5 136.5a136 136 0 1 0 272 0a136 136 0 1 0 -272 0Z",
  "M1088.5 543a136 136 0 1 0 272 0a136 136 0 1 0 -272 0Z",
  "M272.5 815a136 136 0 1 0 272 0a136 136 0 1 0 -272 0Z",
  "M816.5 815a136 136 0 1 0 272 0a136 136 0 1 0 -272 0Z",
  "M136.5 543H272.5A136 136 0 0 0 408.5 679V815H272.5A136 136 0 0 0 136.5 679Z",
  "M544.5 543H680.5V679A136 136 0 0 0 544.5 815H408.5V679A136 136 0 0 0 544.5 543Z",
  "M680.5 543H816.5A136 136 0 0 0 952.5 679V815H816.5A136 136 0 0 0 680.5 679Z",
  "M1088.5 543H1224.5V679A136 136 0 0 0 1088.5 815H952.5V679A136 136 0 0 0 1088.5 543Z",
];

/** The Warden mark alone. `size` is its height; it is 1.43× as wide. */
export function LogoMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={Math.round(size * 1.43)} height={size} viewBox="0.5 0.5 1360 951" fill="currentColor" aria-hidden="true" className={className}>
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The logo + wordmark from the design. */
export function WardenMark() {
  return (
    <div className="flex items-center gap-[11px]">
      <span className="grid size-[34px] place-items-center rounded-[10px] bg-nav text-strong">
        <LogoMark size={13} />
      </span>
      <span className="flex flex-col gap-px">
        <span className="font-display text-sm font-extrabold tracking-[.06em] text-strong">WARDEN</span>
        <span className="text-[9px] tracking-[.09em] text-muted">DEPLOY CONTROL PLANE</span>
      </span>
    </div>
  );
}
