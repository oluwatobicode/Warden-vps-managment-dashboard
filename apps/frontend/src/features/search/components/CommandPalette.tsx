import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare01Icon, Folder01Icon, Layers01Icon, Search01Icon, ServerStack01Icon } from "@hugeicons/core-free-icons";
import type { JumpKind, JumpTarget } from "../hooks/useJumpTargets";

const GROUPS: Array<{ kind: JumpKind; label: string; icon: typeof Search01Icon }> = [
  { kind: "service", label: "Services", icon: Layers01Icon },
  { kind: "page", label: "Pages", icon: DashboardSquare01Icon },
  { kind: "project", label: "Projects", icon: Folder01Icon },
  { kind: "server", label: "Servers", icon: ServerStack01Icon },
];
const PER_GROUP = 6;

/** ⌘K: type to filter, ↑↓ to move, Enter to go, Esc to close. */
export function CommandPalette({ targets, onClose }: { targets: JumpTarget[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // Grouped, then flattened, so ↑↓ walks the list in the order it's shown.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (t: JumpTarget) => !q || t.label.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q);
    return GROUPS.map((g) => ({ ...g, items: targets.filter((t) => t.kind === g.kind && hit(t)).slice(0, PER_GROUP) })).filter((g) => g.items.length);
  }, [targets, query]);
  const flat = shown.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (t: JumpTarget | undefined) => {
    if (!t) return;
    onClose();
    navigate(t.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(Math.min(i, flat.length - 1) + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(Math.min(i, flat.length - 1) - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[current]);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-black/75 px-6 pt-[88px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Jump to" className="flex max-h-[calc(100dvh/var(--ui-scale)-112px)] w-[620px] max-w-full flex-col overflow-hidden rounded-2xl border border-track bg-card shadow-[0_32px_80px_rgba(0,0,0,.6)]">
        <div className="flex items-center gap-3 border-b border-cb px-[18px] py-4">
          <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.5} className="text-sand" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search services, projects, servers, pages…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={flat[current] ? `palette-${flat[current].id}` : undefined}
            className="flex-1 border-none bg-transparent text-sm text-strong outline-none placeholder:text-faint"
          />
          <span className="rounded-md border border-fieldb px-[7px] py-0.5 text-[10px] text-sand">ESC</span>
        </div>

        <div id="palette-list" role="listbox" className="flex-1 overflow-y-auto p-2">
          {flat.length === 0 && <p className="px-3 py-8 text-center text-[12.5px] text-muted-warm">Nothing matches “{query}”.</p>}
          {shown.map((g) => (
            <div key={g.kind} className="mb-1.5 flex flex-col gap-0.5" role="group" aria-label={g.label}>
              <div className="flex items-center gap-2.5 px-3 pt-[9px] pb-[7px]">
                <span className="text-[10px] font-semibold tracking-[.09em] text-sand uppercase">{g.label}</span>
                <span className="h-px flex-1 bg-divider" />
              </div>
              {g.items.map((t) => {
                const on = flat[current]?.id === t.id;
                return (
                  <button
                    key={t.id}
                    id={`palette-${t.id}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActive(flat.indexOf(t))}
                    onClick={() => go(t)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left ${on ? "bg-raised" : ""}`}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-chip text-muted-warm">
                      <HugeiconsIcon icon={g.icon} size={14} strokeWidth={1.5} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className={`truncate text-[12.5px] text-strong ${t.kind === "page" ? "" : "font-mono"}`}>{t.label}</span>
                      <span className="truncate text-[10.5px] text-sand">{t.sub}</span>
                    </span>
                    {on && <span className="font-mono text-[10px] text-sand">↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-[18px] border-t border-cb px-[18px] py-[11px] text-[10.5px] text-sand">
          <span className="flex items-center gap-[7px]"><kbd className="rounded-[5px] border border-fieldb px-1.5 py-px font-mono">↑↓</kbd>move</span>
          <span className="flex items-center gap-[7px]"><kbd className="rounded-[5px] border border-fieldb px-1.5 py-px font-mono">↵</kbd>open</span>
        </div>
      </div>
    </div>
  );
}
