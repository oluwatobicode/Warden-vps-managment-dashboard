import { useId, type ComponentProps } from "react";

interface InputProps extends ComponentProps<"input"> {
  label: string;
  /** From React Hook Form: `formState.errors.field?.message`. */
  error?: string;
  /** Monospace value: hosts, keys, names. */
  mono?: boolean;
}

export function Input({ label, error, mono = false, className = "", id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    // The error sits OUTSIDE the <label>, so the field's accessible name stays
    // just the label ("Key"), and the error is read as its description.
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-xs text-label">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-xl border bg-field px-4 py-3.5 text-[13.5px] text-body outline-none placeholder:text-faint focus:border-focus ${
          error ? "border-crit" : "border-cb"
        } ${mono ? "font-mono text-[13px]" : ""} ${className}`}
        {...rest}
      />
      {error && (
        <span id={errorId} className="text-[11.5px] text-crit">
          {error}
        </span>
      )}
    </div>
  );
}
