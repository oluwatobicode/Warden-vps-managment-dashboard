import { useId, useState, type KeyboardEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import type { GithubRepo } from "../../../github/hooks/useGithub";

const MAX_SHOWN = 100;

/**
 * Type to find a repo: the matches open straight away, under the box, as part
 * of the page (not a floating menu), so they never flip above it. Arrows move,
 * Enter picks, Esc closes. Typing again clears the pick until a new one is made.
 */
export function RepoSearch({ repos, value, onPick, loading, error }: { repos: GithubRepo[]; value: string; onPick: (fullName: string) => void; loading: boolean; error?: string }) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = text.trim().toLowerCase();
  // Just picked (the box shows its name): list everything again, not only that one.
  const shown = (value && text === value ? repos : repos.filter((r) => r.fullName.toLowerCase().includes(q))).slice(0, MAX_SHOWN);

  const pick = (r: GithubRepo) => {
    setText(r.fullName);
    setOpen(false);
    if (r.fullName !== value) onPick(r.fullName);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
    else if (e.key === "Enter") {
      if (!open || !shown[active]) return; // let Enter submit the form
      pick(shown[active]);
    } else if (e.key === "Escape") {
      if (!open) return;
      setOpen(false);
      e.stopPropagation(); // Esc closes the list, not the modal around it
    } else return;
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs text-label">
        Repository
      </label>
      <input
        id={id}
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        disabled={loading}
        placeholder={loading ? "Loading repos…" : "Type to find a repo"}
        value={text}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onFocus={() => (setOpen(true), setActive(0))}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onPick("");
        }}
        onKeyDown={onKey}
        className={`rounded-xl border bg-field px-4 py-3.5 font-mono text-[13px] text-body outline-none placeholder:font-sans placeholder:text-faint focus:border-focus disabled:opacity-60 ${
          error ? "border-crit" : "border-cb"
        }`}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label="Repositories" className="m-0 max-h-[260px] list-none overflow-y-auto rounded-xl border border-cb bg-card p-1.5">
          {shown.length ? (
            shown.map((r, i) => (
              <li
                key={r.fullName}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={r.fullName === value}
                onMouseMove={() => active !== i && setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the box
                onClick={() => pick(r)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] ${i === active ? "bg-raised" : ""}`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate ${r.fullName === value ? "text-strong" : "text-body"}`}>{r.fullName}</span>
                  <span className="truncate text-[10.5px] text-sand">
                    {r.private ? "private" : "public"} · default branch {r.defaultBranch}
                  </span>
                </span>
                {r.fullName === value && <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} className="shrink-0 text-good" />}
              </li>
            ))
          ) : (
            <li className="px-3 py-2.5 text-[12.5px] text-faint">{repos.length ? "No repos match" : "No repos yet"}</li>
          )}
        </ul>
      )}
      {error && (
        <span id={`${id}-error`} className="text-[11.5px] text-crit">
          {error}
        </span>
      )}
    </div>
  );
}
