import { lazy, Suspense, useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { EMPTY_PROXY_FORM, type ProxyConfigView, type ProxyForm, type Server } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { ProxyCard } from "../../deploys/components/ProxyCard";
import { useApplyProxy, useDebounced, useProxyCheck, useProxyConfig } from "../hooks/useProxyConfig";
import { ProxyFormEditor } from "./ProxyFormEditor";
import { RoutesCard } from "./RoutesCard";
import { VersionsCard } from "./VersionsCard";

// CodeMirror (~100 kB) loads only when someone opens the YAML editor.
const RawEditor = lazy(() => import("./RawEditor"));

/** Server page → Proxy: Traefik's status, the routes it serves, and warden.yml (form + YAML, checked, versioned). */
export function ProxyTab({ server, canEdit }: { server: Pick<Server, "id" | "serverName" | "serverType">; canEdit: boolean }) {
  const view = useProxyConfig(server.id);
  if (server.serverType !== "DEPLOY") return <p className="mt-5 text-sm text-sand">Build servers don't run a proxy.</p>;
  return (
    <div className="mt-5 flex flex-col gap-3.5 pb-2">
      <ProxyCard server={server} canEdit={canEdit} editorReady={view.data?.editable} />
      {view.isPending && <Skeleton className="h-48 rounded-[18px]" />}
      {view.isError && <p className="text-sm text-crit">{apiMessage(view.error)}</p>}
      {view.data?.editable && (
        <>
          <RoutesCard routes={view.data.routes} />
          {/* Remounted when the live version changes, so the editor starts from it. */}
          <ConfigEditor key={view.data.current?.versionId ?? "none"} serverId={server.id} view={view.data} canEdit={canEdit} />
          <VersionsCard serverId={server.id} versions={view.data.versions} currentId={view.data.current?.versionId ?? null} canEdit={canEdit} />
        </>
      )}
    </div>
  );
}

function ConfigEditor({ serverId, view, canEdit }: { serverId: string; view: ProxyConfigView; canEdit: boolean }) {
  const start = { form: view.current?.form ?? EMPTY_PROXY_FORM, raw: view.current?.raw ?? "" };
  const [mode, setMode] = useState<"form" | "yaml">(start.raw.trim() ? "yaml" : "form");
  const [form, setForm] = useState<ProxyForm>(start.form);
  const [formValid, setFormValid] = useState(true);
  const [raw, setRaw] = useState(start.raw);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const apply = useApplyProxy(serverId);

  const dirty = JSON.stringify(form) !== JSON.stringify(start.form) || raw !== start.raw;
  const draft = useDebounced({ form, raw }, 500);
  const check = useProxyCheck(serverId, draft.form, draft.raw, canEdit && formValid);
  const problems = check.data?.problems ?? [];
  const settled = draft.form === form && draft.raw === raw && !check.isFetching;
  // Kept stable by the React compiler, so the form's change effect runs once per real change.
  const onFormChange = (f: ProxyForm, valid: boolean) => {
    setForm(f);
    setFormValid(valid);
  };

  const onApply = () =>
    apply.mutate(
      { form, raw, baseVersionId: view.current?.versionId ?? null, note: note.trim() || undefined },
      {
        onSuccess: (r) =>
          r.applied
            ? toast.success("Applied. Traefik loaded it cleanly")
            : toast.error(`Traefik refused it, so the previous version was put back: ${r.problems[0]?.message ?? ""}`, { duration: 10000 }),
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  return (
    <Card title="warden.yml" sub="Extra routing for this server: Traefik reloads it within seconds, with no restart. Changing it is DevOps and Admin.">
      <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn-s px-3.5 py-3 text-[12px] text-warn">
        <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.6} className="mt-px shrink-0" />
        <span>
          {mode === "form"
            ? "A change here goes live for every site on this server. "
            : "Raw Traefik config: a mistake can break routing for every site on this server. "}
          Warden checks it before saving, and if Traefik refuses it anyway, the previous version is put back by itself.
        </span>
      </div>

      <div className="mt-4">
        <Segmented
          label="Edit with"
          value={mode}
          onChange={setMode}
          options={[
            { id: "form", label: "Form", detail: "Routes, redirects, force HTTPS" },
            { id: "yaml", label: "YAML", detail: "Anything else Traefik supports" },
          ]}
        />
      </div>

      <div className="mt-4">
        {mode === "form" ? (
          <ProxyFormEditor value={form} onChange={onFormChange} disabled={!canEdit} />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[11.5px] text-sand">
              Traefik's file-provider format (<span className="font-mono">http:</span> routers, middlewares, services…). The form's settings are added to this automatically, and names starting with{" "}
              <span className="font-mono">form-</span> or <span className="font-mono">svc-</span> are Warden's.
            </p>
            <Suspense fallback={<Skeleton className="h-[260px] rounded-xl" />}>
              <RawEditor value={raw} onChange={setRaw} problems={problems} readOnly={!canEdit} />
            </Suspense>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="mt-3.5" aria-live="polite">
          {!formValid ? (
            <p className="m-0 text-[12px] text-crit">Fix the form's fields first.</p>
          ) : !settled ? (
            <p className="m-0 text-[12px] text-faint">Checking…</p>
          ) : problems.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {problems.map((p, i) => (
                <li key={i} className="font-mono text-[11.5px] break-words text-crit">
                  {p.line ? `line ${p.line}: ` : p.where === "form" ? "form: " : ""}
                  {p.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[12px] text-good">Looks good: valid YAML and valid Traefik config.</p>
          )}
        </div>
      )}

      <button type="button" onClick={() => setPreview((p) => !p)} className="mt-3.5 cursor-pointer text-[12px] text-sand hover:text-strong">
        {preview ? "Hide" : "Show"} the full warden.yml {dirty ? "that will be written" : ""}
      </button>
      {preview && (
        <pre className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-cb bg-[#0b0c0e] px-4 py-3 font-mono text-[11.5px] leading-[1.55] whitespace-pre text-[#c9ccd3]">
          {(dirty ? check.data?.yaml : view.current?.yaml) ?? view.current?.yaml ?? "Nothing yet."}
        </pre>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end justify-end gap-2.5">
          <div className="min-w-[220px] flex-1">
            <Input label="What changed (optional)" placeholder="e.g. redirect www to the bare domain" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            variant="ghost"
            disabled={!dirty || apply.isPending}
            onClick={() => {
              setForm(start.form);
              setRaw(start.raw);
              setMode(start.raw.trim() ? "yaml" : "form");
            }}
            className="text-xs"
          >
            Discard changes
          </Button>
          <Button onClick={onApply} loading={apply.isPending} disabled={!dirty || !formValid || !settled || problems.length > 0}>
            Apply
          </Button>
        </div>
      )}
    </Card>
  );
}
