import type { NotificationEvent } from "shared-types";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { EVENT_GROUPS } from "./eventInfo";

/** Tick the events this channel hears about, grouped by area. */
export function EventPicker({ value, onChange, error }: { value: NotificationEvent[]; onChange: (v: NotificationEvent[]) => void; error?: string }) {
  const toggle = (e: NotificationEvent) => onChange(value.includes(e) ? value.filter((x) => x !== e) : [...value, e]);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs text-label">Events</legend>
      {EVENT_GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-[.08em] text-sand uppercase">{g.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {g.events.map((ev) => {
              const on = value.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(ev.id)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] ${on ? "border-focus bg-raised text-strong" : "border-cb text-muted-warm hover:text-strong"}`}
                >
                  <span className={`grid size-3 place-items-center rounded-[3px] border ${on ? "border-good bg-good" : "border-focus"}`}>
                    {on && <HugeiconsIcon icon={Tick02Icon} size={9} strokeWidth={3.5} className="text-on-primary" />}
                  </span>
                  {ev.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <span className="text-[11.5px] text-crit">{error}</span>}
    </fieldset>
  );
}
