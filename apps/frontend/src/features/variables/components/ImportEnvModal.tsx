import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileUploadIcon } from "@hugeicons/core-free-icons";
import type { Variable } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Textarea } from "../../../components/ui/Textarea";
import { Toggle } from "../../../components/ui/Toggle";
import { parseDotenv } from "../../../utils/dotenv";
import type { BulkResult } from "shared-types";
import { apiReason } from "../../../utils/apiMessage";
import { useImportVariables, type VariableOwner } from "../hooks/useVariables";

const SAMPLE = "# paste your .env here\nDATABASE_URL=postgres://user:pass@db:5432/app\nREDIS_URL=redis://redis:6379\nLOG_LEVEL=info";
const MAX_FILE = 256 * 1024; // a .env is a few KB; anything bigger isn't one

/** Paste a .env, or load one from disk into the editor, check it, import it. */
export function ImportEnvModal({ owner, existing, onClose }: { owner: VariableOwner; existing: Variable[]; onClose: () => void }) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [isSecret, setIsSecret] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [results, setResults] = useState<BulkResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const run = useImportVariables(owner);

  const byKey = useMemo(() => new Map(existing.map((v) => [v.key, v.id])), [existing]);
  const lines = useMemo(() => parseDotenv(text), [text]);
  const usable = lines.filter((l) => !l.error && !l.overridden);
  const clash = usable.filter((l) => byKey.has(l.key));
  const invalid = lines.filter((l) => l.error);
  const willSave = usable.length - (overwrite ? 0 : clash.length);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE) return toast.error("That file is too big to be a .env");
    setText(await file.text());
    setMode("paste"); // show what was read, so it can be checked and edited
  };

  const onImport = () =>
    run.mutate(
      { rows: usable.map((l) => ({ key: l.key, value: l.value })), isSecret, overwrite },
      {
        onSuccess: (r) => {
          setResults(r);
          toast.success("Variables imported");
        },
        // All or nothing: on any error NOTHING was saved, so the user can fix
        // the text and press Import again.
        onError: (e) => toast.error(`Nothing was imported. ${apiReason(e)}`),
      },
    );

  if (results) {
    return (
      <Modal open onClose={onClose} width="w-[620px]" title="Import finished" footer={<><span /><Button onClick={onClose}>Done</Button></>}>
        <p className="m-0 text-[12.5px] text-muted-warm">
          <span className="text-good">{results.added.length} added</span> · {results.updated.length} updated · {results.skipped.length} skipped (already existed)
        </p>
        {results.skipped.length > 0 && (
          <p className="m-0 text-[11.5px] text-sand">
            Skipped: <span className="font-mono">{results.skipped.join(", ")}</span>
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="w-[680px]"
      title="Import .env"
      description="Paste the contents of a .env file, or load one from your computer. Everything is saved together when you press Import, or nothing is."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">Cancel</Button>
          <Button onClick={onImport} disabled={willSave === 0} loading={run.isPending}>
            {run.isPending ? "Importing…" : `Import ${willSave} variable${willSave === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { id: "paste", label: "Paste", detail: "Type or paste KEY=value lines" },
          { id: "upload", label: "Upload a file", detail: ".env from your computer" },
        ]}
      />

      {mode === "paste" ? (
        <Textarea label="Contents" rows={9} placeholder={SAMPLE} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFile(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-4 py-9 text-center ${dragging ? "border-good bg-good-s" : "border-fieldb"}`}
        >
          <HugeiconsIcon icon={FileUploadIcon} size={22} strokeWidth={1.5} className="text-sand" />
          <p className="m-0 text-[12.5px] text-muted-warm">Drop a .env file here, or</p>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} className="px-3.5 py-2 text-xs">Choose file</Button>
          {/* No `accept`: .env files have no file type to filter on. */}
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} aria-label="Choose a .env file" />
        </div>
      )}

      {lines.length > 0 && (
        <>
          <p className="m-0 text-[12px] text-muted-warm">
            <span className="text-strong">{usable.length}</span> found
            {clash.length > 0 && <> · <span className="text-warn">{clash.length} already exist</span></>}
            {invalid.length > 0 && <> · <span className="text-crit">{invalid.length} can't be read</span></>}
          </p>
          <div className="max-h-[220px] overflow-y-auto rounded-xl border border-cb">
            {lines.map((l) => {
              const exists = !l.error && byKey.has(l.key);
              const status = l.error
                ? { text: l.error, cls: "text-crit" }
                : l.overridden
                  ? { text: "Repeated below; the later line is used", cls: "text-sand" }
                  : exists
                    ? { text: overwrite ? "Exists, will be replaced" : "Exists, will be skipped", cls: "text-warn" }
                    : { text: "New", cls: "text-good" };
              return (
                <div key={l.line} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 border-b border-divider px-3.5 py-2 text-[11.5px] last:border-b-0">
                  <span className="font-mono text-faint">{l.line}</span>
                  <span className={`truncate font-mono ${l.error || l.overridden ? "text-sand line-through" : "text-body"}`}>{l.key || "(no key)"}</span>
                  <span className="truncate font-mono text-sand">{l.error ? "" : isSecret ? "••••••••" : l.value || "(empty)"}</span>
                  <span className={`truncate text-right ${status.cls}`}>{status.text}</span>
                </div>
              );
            })}
          </div>
          <Toggle checked={isSecret} onChange={setIsSecret} label="Save all as secrets" detail="Hidden in lists until someone clicks Reveal. Turn off for plain values like LOG_LEVEL." />
          {clash.length > 0 && (
            <Toggle checked={overwrite} onChange={setOverwrite} label={`Replace the ${clash.length} that already exist`} detail="Off: those lines are skipped and the current values stay." />
          )}
        </>
      )}
    </Modal>
  );
}
