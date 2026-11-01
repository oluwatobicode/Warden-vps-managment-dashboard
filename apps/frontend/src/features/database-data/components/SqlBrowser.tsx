import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { DataTable } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { apiMessage } from "../../../utils/apiMessage";
import { quoteFor, rowKey } from "../cells";
import { useDataRows, useDataTables, useDeleteRows, type RowsView } from "../hooks/useDatabaseData";
import { ResultGrid } from "./ResultGrid";
import { CellEditor, InsertRowModal } from "./RowEditors";
import { SqlConsole } from "./SqlConsole";

const PAGE = 50;
type Mode = "rows" | "sql";

/** Postgres and MySQL: tables on the left; a table's rows (edit, add, delete) or the SQL box on the right. */
export function SqlBrowser({ serviceId }: { serviceId: string }) {
  const tables = useDataTables(serviceId);
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<DataTable | null>(null);
  const [mode, setMode] = useState<Mode>("rows");

  if (tables.isPending) return <p className="mt-4 flex items-center gap-2 text-[12px] text-faint"><Spinner /> Connecting to the database…</p>;
  if (tables.isError) {
    return (
      <div className="mt-4 flex items-center gap-3">
        <p className="m-0 text-[12.5px] text-crit">{apiMessage(tables.error, "Couldn't reach the database")}</p>
        <Button variant="secondary" onClick={() => void tables.refetch()}>Try again</Button>
      </div>
    );
  }
  const list = tables.data.tables.filter((t) => `${t.schema}.${t.name}`.toLowerCase().includes(filter.toLowerCase()));
  const many = new Set(tables.data.tables.map((t) => t.schema)).size > 1;
  const current = picked && tables.data.tables.find((t) => t.schema === picked.schema && t.name === picked.name) ? picked : null;

  return (
    <div className="mt-4 flex gap-4">
      <aside className="flex w-[220px] shrink-0 flex-col gap-2">
        <input
          type="search"
          aria-label="Find a table"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a table"
          className="rounded-lg border border-cb bg-field px-3 py-2 text-[12px] text-body outline-none placeholder:text-faint focus:border-focus"
        />
        <nav aria-label="Tables" className="flex max-h-[600px] flex-col overflow-y-auto">
          {list.map((t) => {
            const on = current?.schema === t.schema && current.name === t.name;
            return (
              <button
                key={`${t.schema}.${t.name}`}
                type="button"
                onClick={() => {
                  setPicked(t);
                  setMode("rows");
                }}
                className={`flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left font-mono text-[12px] ${on && mode === "rows" ? "bg-[#24262c] text-white" : "text-sand hover:text-strong"}`}
              >
                <span className="truncate">
                  {many && <span className="text-faint">{t.schema}.</span>}
                  {t.name}
                  {t.kind === "view" && <span className="text-faint"> view</span>}
                </span>
                {t.estimate !== null && <span className="shrink-0 text-[10.5px] text-faint">~{t.estimate.toLocaleString()}</span>}
              </button>
            );
          })}
          {!list.length && <p className="px-2.5 text-[11.5px] text-faint">{tables.data.tables.length ? "No table matches." : "No tables yet. Create one in the SQL box."}</p>}
        </nav>
        <Button variant={mode === "sql" ? "primary" : "secondary"} onClick={() => setMode("sql")}>
          SQL box
        </Button>
        <button type="button" onClick={() => void tables.refetch()} className="cursor-pointer text-left text-[11.5px] text-faint hover:text-strong">
          {tables.isFetching ? "Reloading…" : "Reload tables"}
        </button>
      </aside>

      <section className="min-w-0 flex-1">
        {mode === "sql" ? (
          // key: picking a table and going back to SQL starts from a query on it.
          <SqlConsole key={current ? `${current.schema}.${current.name}` : "none"} serviceId={serviceId} initial={current ? `select * from ${quoteFor(tables.data.engine, current)} limit 50` : ""} />
        ) : current ? (
          <TableRows key={`${current.schema}.${current.name}`} serviceId={serviceId} table={current} />
        ) : (
          <EmptyState title={tables.data.tables.length ? "Pick a table" : "No tables yet"}>
            {tables.data.tables.length ? "Its rows show here: click a cell to change it, or add and delete rows." : "Create one with the SQL box, or let your app's migrations create them."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}

function TableRows({ serviceId, table }: { serviceId: string; table: DataTable }) {
  const [view, setView] = useState<RowsView>({ schema: table.schema, table: table.name, offset: 0, limit: PAGE, dir: "asc" });
  const rows = useDataRows(serviceId, view);
  const del = useDeleteRows(serviceId);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const target = { serviceId, schema: table.schema, table: table.name };
  const data = rows.data;
  const cut = useMemo(() => new Set((data?.cut ?? []).map(([r, c]) => `${r}:${c}`)), [data]);
  const isView = table.kind === "view";
  const editable = !!data?.editable && !isView;

  const move = (patch: Partial<RowsView>) => {
    setSelected(new Set());
    setView((v) => ({ ...v, ...patch }));
  };
  const sortBy = (column: string) => move({ sort: column, dir: view.sort === column && view.dir === "asc" ? "desc" : "asc", offset: 0 });
  const removeSelected = () =>
    del.mutate(
      { schema: table.schema, table: table.name, keys: [...selected].map((i) => rowKey(data!.columns, data!.rows[i]!)), confirm: table.name },
      {
        onSuccess: (r) => {
          toast.success(`${r.changed} row${r.changed === 1 ? "" : "s"} deleted`);
          setSelected(new Set());
          setDeleting(false);
        },
        onError: (e) => {
          setDeleting(false);
          toast.error(apiMessage(e, "Couldn't delete the rows"));
        },
      },
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate font-mono text-[15px] font-semibold text-strong">{table.name}</h3>
          <p className="m-0 mt-1 text-[11.5px] text-faint">
            {isView ? "A view: read-only." : editable ? "Click a cell to change it." : data ? "No primary key, so rows can't be edited here: use the SQL box." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Delete {selected.size} row{selected.size === 1 ? "" : "s"}
            </Button>
          )}
          {!isView && data && (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Add row
            </Button>
          )}
          <Button variant="ghost" onClick={() => void rows.refetch()} loading={rows.isFetching}>
            Reload
          </Button>
        </div>
      </div>

      {rows.isPending ? (
        <p className="flex items-center gap-2 text-[12px] text-faint"><Spinner /> Loading rows…</p>
      ) : rows.isError ? (
        <p className="text-[12.5px] text-crit">{apiMessage(rows.error, "Couldn't load the rows")}</p>
      ) : data!.rows.length === 0 && view.offset === 0 ? (
        <EmptyState title="No rows">This table is empty.</EmptyState>
      ) : (
        <ResultGrid
          columns={data!.columns.map((c) => ({ name: c.name, hint: c.type, pk: c.pk }))}
          rows={data!.rows}
          cut={cut}
          sort={{ column: view.sort, dir: view.dir }}
          onSort={sortBy}
          selected={editable ? selected : undefined}
          onSelect={editable ? (i, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(i); else n.delete(i); return n; }) : undefined}
          onCell={editable ? (row, col) => setEditing({ row, col }) : undefined}
        />
      )}

      {data && (
        <div className="flex items-center justify-between text-[11.5px] text-sand">
          <span>
            Rows {data.rows.length ? (view.offset + 1).toLocaleString() : 0}–{(view.offset + data.rows.length).toLocaleString()}
            {table.estimate !== null && ` of ~${table.estimate.toLocaleString()}`}
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" disabled={view.offset === 0 || rows.isFetching} onClick={() => move({ offset: Math.max(0, view.offset - PAGE) })}>
              Previous
            </Button>
            <Button variant="secondary" disabled={!data.hasMore || rows.isFetching} onClick={() => move({ offset: view.offset + PAGE })}>
              Next
            </Button>
          </span>
        </div>
      )}

      {editing && data && (
        <CellEditor
          target={target}
          column={data.columns[editing.col]!}
          value={data.rows[editing.row]![editing.col]}
          rowKey={rowKey(data.columns, data.rows[editing.row]!)}
          cut={cut.has(`${editing.row}:${editing.col}`)}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && data && <InsertRowModal target={target} columns={data.columns} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={removeSelected}
        loading={del.isPending}
        title={`Delete ${selected.size} row${selected.size === 1 ? "" : "s"} from ${table.name}?`}
        body="They're gone for good: there's no undo (backups are the way back). If any of them changed since you loaded them, nothing is deleted."
        cta="Delete rows"
        phrase={table.name}
      />
    </div>
  );
}
