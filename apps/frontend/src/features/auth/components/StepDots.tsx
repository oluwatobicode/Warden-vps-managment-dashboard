/** The three progress bars at the top of the signup card. */
export function StepDots({ step, of = 3 }: { step: number; of?: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${step} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-[3px] flex-1 rounded-sm ${i < step ? "bg-strong" : "bg-track"}`} />
      ))}
    </div>
  );
}

/** "STEP 1 OF 3 · YOUR EMAIL" */
export function StepKicker({ children }: { children: string }) {
  return <p className="m-0 text-[10.5px] font-semibold tracking-[.09em] text-sand uppercase">{children}</p>;
}
