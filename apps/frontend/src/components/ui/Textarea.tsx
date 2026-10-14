import { useId, type ComponentProps } from "react";

interface TextareaProps extends ComponentProps<"textarea"> {
  label: string;
  error?: string;
}

export function Textarea({ label, error, id, className = "", ...rest }: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={areaId} className="text-xs text-label">
        {label}
      </label>
      <textarea
        id={areaId}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-error` : undefined}
        className={`resize-y rounded-[10px] border bg-[#0a0a0a] px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-strong outline-none placeholder:text-faint focus:border-focus ${error ? "border-crit" : "border-cb"} ${className}`}
        {...rest}
      />
      {error && (
        <span id={`${areaId}-error`} className="text-[11.5px] text-crit">
          {error}
        </span>
      )}
    </div>
  );
}
