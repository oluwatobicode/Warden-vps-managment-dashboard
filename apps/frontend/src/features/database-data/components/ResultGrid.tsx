import { cellText } from "../cells";

export interface GridColumn {
  name: string;
  /** Shown under the name (the column's type). */
  hint?: string;
  pk?: boolean;
}

interface ResultGridProps {
  columns: GridColumn[];
  rows: unknown[][];
  /** "row:col" of cells that were cut. */
  cut?: Set<string>;
  sort?: { column?: string; dir: "asc" | "desc" };
  onSort?: (column: string) => void;
  /** Row checkboxes (for delete). */
  selected?: Set<number>;
  onSelect?: (row: number, on: boolean) => void;
  onCell?: (row: number, col: number) => void;
}

/** A table of database values: NULL in its own colour, long values cut to one line (click to see them whole). */
export function ResultGrid({ columns, rows, cut, sort, onSort, selected, onSelect, onCell }: ResultGridProps) {
  return (
    <div className="max-h-[560px] overflow-auto rounded-xl border border-cb bg-[#0b0c0e]">
      <table className="w-max min-w-full border-collapse font-mono text-[11.5px]">
        <thead className="sticky top-0 z-10 bg-raised">
          <tr>
            {onSelect && <th className="w-8 border-b border-cb px-2" aria-label="Select" />}
            {columns.map((c, i) => {
              const sorted = sort?.column === c.name;
              return (
                <th key={`${c.name}-${i}`} scope="col" className="border-b border-cb px-3 py-2 text-left align-bottom font-semibold whitespace-nowrap text-strong">
                  {onSort ? (
                    <button type="button" onClick={() => onSort(c.name)} className="cursor-pointer text-left hover:text-white" aria-label={`Sort by ${c.name}`}>
                      {c.pk && <span className="mr-1 text-warn">●</span>}
                      {c.name}
                      {sorted && <span className="ml-1 text-sand">{sort.dir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ) : (
                    c.name
                  )}
                  {c.hint && <span className="block text-[10px] font-normal text-faint">{c.hint}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={`border-b border-cb/50 ${selected?.has(ri) ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
              {onSelect && (
                <td className="px-2 text-center">
                  <input type="checkbox" aria-label={`Select row ${ri + 1}`} checked={selected?.has(ri) ?? false} onChange={(e) => onSelect(ri, e.target.checked)} className="cursor-pointer accent-white" />
                </td>
              )}
              {r.map((v, ci) => {
                const text = cellText(v);
                const isCut = cut?.has(`${ri}:${ci}`);
                return (
                  <td key={ci} className="max-w-[360px] p-0">
                    <button
                      type="button"
                      onClick={onCell ? () => onCell(ri, ci) : undefined}
                      disabled={!onCell}
                      title={text.length > 60 ? text.slice(0, 2000) : undefined}
                      className={`block w-full truncate px-3 py-[5px] text-left enabled:cursor-pointer enabled:hover:bg-white/[0.05] ${v === null ? "text-faint italic" : "text-[#c9ccd3]"}`}
                    >
                      {text}
                      {isCut && <span className="text-warn"> [cut]</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
