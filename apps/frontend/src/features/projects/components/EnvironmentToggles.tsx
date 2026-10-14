import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

const STARTER_ENVIRONMENTS = ["production", "staging", "preview"] as const;

export function EnvironmentToggles({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const toggle = (name: string) =>
    onChange(
      value.includes(name) ? value.filter((v) => v !== name) : [...value, name],
    );
  return (
    <fieldset className="flex flex-col gap-[9px]">
      <legend className="mb-[9px] text-xs text-label">
        Start with these environments
      </legend>
      <div className="flex gap-2">
        {STARTER_ENVIRONMENTS.map((name) => {
          const on = value.includes(name);
          return (
            <button
              key={name}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(name)}
              className={`flex flex-1 cursor-pointer items-center gap-[9px] rounded-[10px] border px-[13px] py-[11px] ${
                on ? "border-focus bg-raised" : "border-cb bg-transparent"
              }`}
            >
              <span
                className={`grid size-[15px] shrink-0 place-items-center rounded border-[1.5px] ${on ? "border-strong bg-strong" : "border-focus"}`}
              >
                {on && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={10}
                    strokeWidth={3.4}
                    className="text-on-primary"
                  />
                )}
              </span>
              <span
                className={`font-mono text-[11.5px] ${on ? "text-strong" : "text-muted-warm"}`}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>
      {error && <span className="text-[11.5px] text-crit">{error}</span>}
    </fieldset>
  );
}
