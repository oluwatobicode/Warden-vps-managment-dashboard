export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-focus border-t-strong ${className}`}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen-ui place-items-center">
      <Spinner className="size-5" />
    </div>
  );
}
