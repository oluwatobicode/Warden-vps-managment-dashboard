import { useEffect, useRef } from "react";
import type { LogLine } from "shared-types";
import { CopyButton } from "../../../components/ui/CopyButton";
import { Drawer } from "../../../components/ui/Drawer";
import { apiMessage } from "../../../utils/apiMessage";
import { useLogContext } from "../hooks/useLogs";
import { lineTime, splitMatch } from "../lines";

const STREAM_LABEL = { STDOUT: "stdout", STDERR: "stderr (errors)", WARDEN: "Warden" } as const;

/** One line in full, and the 50 lines before and after it in the same service (or server). */
export function LineDrawer({ line, serviceName, server = false, query, onClose }: { line: LogLine; serviceName?: string; server?: boolean; query: string; onClose: () => void }) {
  const context = useLogContext(line.id, server);
  const self = useRef<HTMLLIElement>(null);
  // A block, not an expression: newer browsers return a Promise from scrollIntoView, and an effect may only return a cleanup.
  useEffect(() => {
    self.current?.scrollIntoView({ block: "center" });
  }, [context.data]);

  return (
    <Drawer
      open
      onClose={onClose}
      kicker={serviceName ? serviceName.toUpperCase() : "LOG LINE"}
      title={lineTime(line.ts)}
      description={`${new Date(line.ts).toLocaleString("en-GB")}${server ? "" : ` · ${STREAM_LABEL[line.stream]}`}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-label">The line</span>
          <CopyButton value={line.message} text="Copy" done="Line copied" />
        </div>
        <pre className="m-0 max-h-[260px] overflow-auto rounded-xl border border-cb bg-[#0b0c0e] px-4 py-3 font-mono text-[11.5px] leading-[1.55] break-words whitespace-pre-wrap text-[#c9ccd3]">
          {line.message || " "}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-label">Around it</span>
        {context.isPending ? (
          <p className="text-[12px] text-faint">Loading…</p>
        ) : context.isError ? (
          <p className="text-[12px] text-crit">{apiMessage(context.error, "Couldn't load the lines around it")}</p>
        ) : (
          <ol className="m-0 max-h-[420px] list-none overflow-auto rounded-xl border border-cb bg-[#0b0c0e] p-0 py-2 font-mono text-[11px] text-[#c9ccd3]">
            {context.data.items.map((l) => {
              const me = l.id === line.id;
              return (
                <li key={l.id} ref={me ? self : undefined} className={`flex gap-3 px-3.5 py-px ${me ? "bg-[#e5c07b]/10" : ""} ${l.stream === "STDERR" ? "text-[#f0a8a0]" : ""}`}>
                  <span className="shrink-0 text-faint">{lineTime(l.ts)}</span>
                  <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                    {splitMatch(l.message, me ? query : "").map((p, i) => (p.hit ? <mark key={i} className="rounded-[3px] bg-[#e5c07b]/25 text-[#f3d9a4]">{p.text}</mark> : <span key={i}>{p.text}</span>))}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
