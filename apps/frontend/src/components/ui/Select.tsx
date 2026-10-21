import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

export interface SelectOption {
  value: string;
  label: string;
  /** A second, quieter line: "default", "512 MB free"… */
  hint?: string;
  /** Shown before the label, in the list and on the button. */
  icon?: ReactNode;
}

interface SelectProps {
  label: string;
  /** From React Hook Form: `formState.errors.field?.message`. */
  error?: string;
  options: ReadonlyArray<SelectOption>;
  /** An empty first choice (value ""), e.g. "No server". */
  placeholder?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /** React Hook Form's `field.ref`, so a field with an error gets focus. */
  ref?: Ref<HTMLButtonElement>;
}

const MENU_MAX_PX = 260;

/**
 * Our own dropdown, in place of the browser's <select>. Works like one from
 * the keyboard: Enter/Space/arrows open it, arrows/Home/End move, typing jumps
 * to a match, Enter picks, Esc closes. Screen readers get the listbox roles.
 * Controlled: with React Hook Form, use it through `Controller`.
 */
export function Select({ label, error, options, placeholder, value, onChange, onBlur, disabled, id, name, className = "", ref }: SelectProps) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const labelId = `${buttonId}-label`;
  const listId = `${buttonId}-list`;
  const all: SelectOption[] = placeholder !== undefined ? [{ value: "", label: placeholder }, ...options] : [...options];
  const selectedIndex = all.findIndex((o) => o.value === (value ?? ""));
  const selected = selectedIndex >= 0 ? all[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [upward, setUpward] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const setButtonRef = (el: HTMLButtonElement | null) => {
    buttonRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const openMenu = (at = Math.max(selectedIndex, 0)) => {
    if (disabled || !all.length) return;
    // Open upward when the space below (inside the modal/drawer that scrolls,
    // or the window) is too small. Both sides measured the same way, so the
    // UI zoom doesn't matter.
    const btn = buttonRef.current?.getBoundingClientRect();
    const box = scrollParent(wrapRef.current)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    if (btn) setUpward(box.bottom - btn.bottom < MENU_MAX_PX && btn.top - box.top > box.bottom - btn.bottom);
    setActive(at);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (i: number) => {
    const o = all[i];
    if (o && o.value !== (value ?? "")) onChange(o.value);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const outside = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open, onBlur]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /** Typing letters jumps to the next option starting with them, like a native select. */
  const typeahead = (key: string, now: number) => {
    typed.current = { text: now - typed.current.at > 600 ? key : typed.current.text + key, at: now };
    const q = typed.current.text.toLowerCase();
    const from = open ? active : Math.max(selectedIndex, 0);
    // One letter: the NEXT match (pressing "p" again cycles). More: keep the current if it still matches.
    const start = q.length > 1 ? from : from + 1;
    for (let n = 0; n < all.length; n++) {
      const i = (start + n) % all.length;
      if (all[i].label.toLowerCase().startsWith(q)) return i;
    }
    return -1;
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const i = typeahead(e.key, e.timeStamp);
      if (i >= 0) openMenu(i);
    }
  };

  const onListKey = (e: KeyboardEvent) => {
    const last = all.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, last));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") {
      setOpen(false);
      onBlur?.();
      return; // let focus move on
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const i = typeahead(e.key, e.timeStamp);
      if (i >= 0) setActive(i);
    } else return;
    e.preventDefault();
    e.stopPropagation(); // Esc closes the list, not the modal around it
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs text-label">
        {label}
      </span>
      <div ref={wrapRef} className="relative">
        <button
          ref={setButtonRef}
          id={buttonId}
          name={name}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${buttonId}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${buttonId}-error` : undefined}
          onClick={() => (open ? close(false) : openMenu())}
          onKeyDown={onButtonKey}
          onBlur={() => !open && onBlur?.()}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-field px-4 py-3.5 text-left text-[13px] outline-none focus-visible:border-focus disabled:cursor-not-allowed disabled:opacity-60 ${
            open ? "border-focus" : error ? "border-crit" : "border-cb"
          } ${className}`}
        >
          {selected?.icon}
          <span className={`min-w-0 flex-1 truncate ${selected && selected.value !== "" ? "text-body" : "text-faint"}`}>{selected?.label ?? placeholder ?? "Choose…"}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.8} className={`shrink-0 text-sand transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${buttonId}-opt-${active}`}
            onKeyDown={onListKey}
            style={{ maxHeight: MENU_MAX_PX }}
            className={`absolute right-0 left-0 z-[70] m-0 list-none overflow-y-auto rounded-xl border border-cb bg-card p-1.5 shadow-[0_18px_48px_rgba(0,0,0,.55)] outline-none ${
              upward ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            {all.map((o, i) => {
              const isSelected = i === selectedIndex;
              return (
                <li
                  key={o.value || "__empty"}
                  id={`${buttonId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseMove={() => active !== i && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the list
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] ${i === active ? "bg-raised" : ""}`}
                >
                  {o.icon}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`truncate ${o.value === "" ? "text-faint" : isSelected ? "text-strong" : "text-body"}`}>{o.label}</span>
                    {o.hint && <span className="truncate text-[10.5px] text-sand">{o.hint}</span>}
                  </span>
                  {isSelected && <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} className="shrink-0 text-good" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && (
        <span id={`${buttonId}-error`} className="text-[11.5px] text-crit">
          {error}
        </span>
      )}
    </div>
  );
}

/** The nearest ancestor that scrolls (a modal or drawer body), if any. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}
