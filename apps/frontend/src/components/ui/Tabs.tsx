/** Underlined tab row (service page, server page, project settings). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="mt-5 flex gap-1 overflow-x-auto border-b border-divider">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`relative cursor-pointer px-[15px] pt-[11px] pb-3 text-[12.5px] font-semibold whitespace-nowrap ${on ? "text-strong" : "text-muted-warm hover:text-strong"}`}
          >
            {t.label}
            {on && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-strong" />}
          </button>
        );
      })}
    </div>
  );
}
