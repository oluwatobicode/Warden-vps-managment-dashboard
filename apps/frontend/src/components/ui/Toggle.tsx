/** On/off switch with its label and an optional explanation. */
export function Toggle({
  checked,
  onChange,
  label,
  detail,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  detail?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[12.5px] text-body">{label}</span>
        {detail && <span className="text-[10.5px] text-pretty text-sand">{detail}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-xl p-[3px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "justify-end bg-good" : "justify-start bg-fieldb"}`}
      >
        <span className="size-4 rounded-full bg-white" />
      </button>
    </div>
  );
}
