import type { ReactNode } from "react";

/** Pill group for picking one of a few options (service type, key mode…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ id: T; label: string; detail?: string; icon?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-[9px]">
      {label && <span className="text-xs text-label">{label}</span>}
      <div role="radiogroup" className="flex gap-2">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-left ${on ? "border-focus bg-raised" : "border-cb"}`}
            >
              <span className="mt-px grid size-[15px] shrink-0 place-items-center rounded-full border-[1.5px] border-focus">
                {on && <span className="size-[7px] rounded-full bg-good" />}
              </span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className={`flex items-center gap-1.5 text-xs ${on ? "text-strong" : "text-muted-warm"}`}>
                  {o.icon}
                  {o.label}
                </span>
                {o.detail && <span className="text-[10.5px] text-sand">{o.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
