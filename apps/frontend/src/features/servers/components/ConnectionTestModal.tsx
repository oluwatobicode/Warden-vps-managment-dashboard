import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { ConnectionStep, Server } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { CloseButton } from "../../../components/ui/CloseButton";
import { apiMessage } from "../../../utils/apiMessage";
import { useTestConnection } from "../hooks/useServers";
import { STEP_LABEL } from "./serverLabels";

/** Runs POST /servers/:id/test as soon as it opens, then shows each step. */
export function ConnectionTestModal({ server, onClose }: { server: Server; onClose: () => void }) {
  const test = useTestConnection(server.id);
  const started = useRef(false);

  useEffect(() => {
    // Once per open, even under StrictMode's double mount in dev.
    if (started.current) return;
    started.current = true;
    test.mutate();
  }, [test]);

  const steps: ConnectionStep[] = test.data?.steps ?? (["reach", "login", "system", "docker"] as const).map((name) => ({ name, ok: false }));

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-black/75 p-6" onMouseDown={(e) => e.target === e.currentTarget && !test.isPending && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="test-title" className="w-[460px] max-w-full rounded-[20px] border border-cb bg-surface px-7 py-[26px]">
        <div className="flex items-center justify-between gap-3.5">
          <h3 id="test-title" className="m-0 text-lg font-bold tracking-[-0.3px] text-strong">Testing {server.serverName}</h3>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-sand">{server.serverIp}:{server.serverPort}</span>
            {/* Disabled mid-test: the server is being contacted and its status updated. */}
            <CloseButton onClick={onClose} disabled={test.isPending} />
          </span>
        </div>

        <ul className="mt-[18px] flex flex-col gap-0.5" aria-live="polite">
          {steps.map((s) => {
            const skipped = s.detail === "skipped";
            return (
              <li key={s.name} className="flex items-center gap-[11px] px-1 py-2.5">
                {test.isPending ? (
                  <Spinner />
                ) : s.ok ? (
                  <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2.6} className="shrink-0 text-good" />
                ) : skipped ? (
                  <span className="mx-1 size-[7px] shrink-0 rounded-full bg-[#2e2e2e]" />
                ) : (
                  <HugeiconsIcon icon={CancelCircleIcon} size={15} strokeWidth={2} className="shrink-0 text-crit" />
                )}
                <span className={`flex-1 text-[12.5px] ${skipped ? "text-sand" : "text-body"}`}>{STEP_LABEL[s.name]}</span>
                <span className={`max-w-[200px] truncate text-right font-mono text-[11px] ${s.ok || skipped ? "text-muted-deep" : "text-crit"}`}>{test.isPending ? "" : s.detail}</span>
              </li>
            );
          })}
        </ul>

        {test.data && (
          <div className={`mt-3.5 flex items-center gap-[9px] rounded-xl px-4 py-[13px] text-xs font-semibold ${test.data.ok ? "bg-good-s text-good" : "bg-crit-s text-crit"}`}>
            <span className={`size-[7px] rounded-full ${test.data.ok ? "bg-good" : "bg-crit"}`} />
            {test.data.ok
              ? test.data.steps.every((s) => s.ok)
                ? "All checks passed. Status set to Connected"
                : "Logged in, but Docker isn't ready on this host"
              : "Couldn't connect. Status set to Offline"}
          </div>
        )}
        {test.isError && <p className="mt-3.5 text-xs text-crit">{apiMessage(test.error)}</p>}

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose} disabled={test.isPending}>{test.isPending ? "Testing…" : "Done"}</Button>
        </div>
      </div>
    </div>
  );
}
