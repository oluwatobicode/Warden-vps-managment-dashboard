import { useId, type ComponentProps } from "react";

interface SelectProps extends ComponentProps<"select"> {
  label: string;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}

/** A native <select>: keyboard and screen readers work for free. */
export function Select({ label, error, options, placeholder, id, className = "", ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-xs text-label">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={`cursor-pointer appearance-none rounded-xl border bg-field px-4 py-3.5 text-[13px] text-body outline-none focus:border-focus ${error ? "border-crit" : "border-cb"} ${className}`}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${selectId}-error`} className="text-[11.5px] text-crit">
          {error}
        </span>
      )}
    </div>
  );
}
