/** The shield logo + wordmark from the design. */
export function WardenMark() {
  return (
    <div className="flex items-center gap-[11px]">
      <span className="grid size-[34px] place-items-center rounded-[10px] bg-nav">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 4 6v6c0 4.4 3.3 8.2 8 9 4.7-.8 8-4.6 8-9V6l-8-3Z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
      </span>
      <span className="flex flex-col gap-px">
        <span className="font-display text-sm font-extrabold tracking-[.06em] text-strong">WARDEN</span>
        <span className="text-[9px] tracking-[.09em] text-muted">DEPLOY CONTROL PLANE</span>
      </span>
    </div>
  );
}
