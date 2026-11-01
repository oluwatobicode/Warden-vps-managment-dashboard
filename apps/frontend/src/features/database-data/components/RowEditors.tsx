import { useState } from "react";
import toast from "react-hot-toast";
import type { DataColumn } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { apiMessage } from "../../../utils/apiMessage";
import { cellText, editText } from "../cells";
import { useInsertRow, useUpdateRow } from "../hooks/useDatabaseData";

interface Target {
  serviceId: string;
  schema: string;
  table: string;
}

/**
 * One cell: what it is now, what it'll be, then Save. The modal IS the
 * confirmation: nothing is written until "Save change".
 */
export function CellEditor({ target, column, value, rowKey, cut, onClose }: { target: Target; column: DataColumn; value: unknown; rowKey: Record<string, unknown>; cut: boolean; onClose: () => void }) {
  const update = useUpdateRow(target.serviceId);
  const [text, setText] = useState(editText(value));
  const [isNull, setNull] = useState(value === null);
  const where = Object.entries(rowKey)
    .map(([k, v]) => `${k} = ${cellText(v)}`)
    .join(", ");
  const changed = isNull ? value !== null : value === null || text !== editText(value);
  const save = () =>
    update.mutate(
      { schema: target.schema, table: target.table, key: rowKey, values: { [column.name]: isNull ? null : text } },
      {
        onSuccess: () => {
          toast.success(`${column.name} saved`);
          onClose();
        },
        onError: (e) => toast.error(apiMessage(e, "Couldn't save the change")),
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      width="w-[640px]"
      title={`${target.table}.${column.name}`}
      description={`${column.type} · the row where ${where}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!changed || cut}>
            Save change
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {cut ? (
          <p className="text-[12px] text-warn">This value is too long to edit here (only its start was loaded). Change it with an UPDATE in the SQL box.</p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-label">Now</span>
          <pre className={`m-0 max-h-[140px] overflow-auto rounded-lg border border-cb bg-[#0b0c0e] px-3 py-2 font-mono text-[11.5px] break-words whitespace-pre-wrap ${value === null ? "text-faint italic" : "text-[#c9ccd3]"}`}>
            {value === null ? "NULL" : editText(value)}
          </pre>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-label">New value</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isNull || cut}
            spellCheck={false}
            rows={6}
            className="rounded-lg border border-fieldb bg-field px-3 py-2 font-mono text-[12px] text-body outline-none focus:border-focus disabled:opacity-40"
          />
        </label>
        {column.nullable && (
          <label className="flex items-center gap-2 text-[12px] text-sand">
            <input type="checkbox" checked={isNull} onChange={(e) => setNull(e.target.checked)} disabled={cut} className="accent-white" />
            Set to NULL
          </label>
        )}
        <p className="m-0 text-[11px] text-faint">Typed as text; the database turns it into the column's type ({column.type}), or says why it can't.</p>
      </div>
    </Modal>
  );
}

/** A new row: a field per column; columns left on "default" are left out, so the database fills them. */
export function InsertRowModal({ target, columns, onClose }: { target: Target; columns: DataColumn[]; onClose: () => void }) {
  const insert = useInsertRow(target.serviceId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [useDefault, setUseDefault] = useState<Record<string, boolean>>(() => Object.fromEntries(columns.map((c) => [c.name, c.hasDefault || c.nullable])));
  const save = () => {
    const body = Object.fromEntries(columns.filter((c) => !useDefault[c.name]).map((c) => [c.name, values[c.name] ?? ""]));
    insert.mutate(
      { schema: target.schema, table: target.table, values: body },
      {
        onSuccess: () => {
          toast.success(`Row added to ${target.table}`);
          onClose();
        },
        onError: (e) => toast.error(apiMessage(e, "Couldn't add the row")),
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      width="w-[620px]"
      title={`Add a row to ${target.table}`}
      description="Leave a column on default and the database fills it (its default, an auto number, or NULL)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={insert.isPending}>
            Add row
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {columns.map((c) => {
          const dflt = !!useDefault[c.name];
          return (
            <div key={c.name} className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-label">
                  {c.name} <span className="text-faint">{c.type}</span>
                </span>
                {(c.hasDefault || c.nullable) && (
                  <label className="flex items-center gap-1.5 text-sand">
                    <input type="checkbox" checked={dflt} onChange={(e) => setUseDefault((d) => ({ ...d, [c.name]: e.target.checked }))} className="accent-white" />
                    default
                  </label>
                )}
              </span>
              <input
                aria-label={c.name}
                value={values[c.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [c.name]: e.target.value }))}
                disabled={dflt}
                spellCheck={false}
                className="rounded-lg border border-fieldb bg-field px-3 py-2 font-mono text-[12px] text-body outline-none focus:border-focus disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
