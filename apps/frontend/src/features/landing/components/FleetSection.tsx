import { FLEET, TRAEFIK_YAML, type FleetServer } from "../data";
import { CheckIcon, Dot, Meter, SectionIntro } from "./bits";
import { TONE } from "../tone";

function ServerCard({ s }: { s: FleetServer }) {
  return (
    <div className="l-panel flex flex-[0_0_300px] flex-col rounded-xl">
      <div className="flex items-center justify-between border-b border-[#23252a] px-4 py-3.5">
        <span className="flex items-center gap-2">
          <Dot tone={s.tone} size={7} />
          <span className="l-mono text-[13px] text-[#e5e5e6]">{s.host}</span>
          <span className="rounded bg-[#23252a] px-1.5 py-px text-[11px] text-[#8a8f98]">{s.provider}</span>
        </span>
        <span className="text-xs" style={{ color: s.tone }}>{s.state}</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-3">
          <Meter label="CPU" value={s.cpu} />
          <Meter label="MEM" value={s.mem} />
          <Meter label="DISK" value={s.disk} alert={s.disk >= 90} />
        </div>
        {s.warning && <div className="rounded-md bg-[rgba(235,87,87,0.08)] px-3 py-2 text-xs leading-normal text-[#eb5757]">{s.warning}</div>}
        <div className="flex flex-col gap-1.5">
          {s.rows.map(([tone, name, note]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-md bg-[#161718] px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Dot tone={tone} />
                <span className="l-mono truncate text-xs text-[#d0d6e0]">{name}</span>
              </span>
              <span className="shrink-0 text-[11px] text-[#62666d]">{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PROXY_CHECKS = ["Valid YAML", "Matches Traefik’s schema", "Every route points at a service that exists"];

/** The proxy editor: what a team edits, and what Warden checks before it goes live. */
function ProxyEditor() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-center gap-x-16 gap-y-10">
      <div className="flex flex-col gap-5">
        <h3 className="m-0 text-[clamp(24px,2.6vw,32px)] leading-[1.15] font-semibold tracking-[-0.6px] text-white">
          Edit the proxy without fear.{" "}
          <span className="text-[#8a8f98]">
            Change Traefik with a form or in YAML. Warden checks it before saving, confirms Traefik took it, and writes the previous version back by itself if Traefik refuses it. Every version is kept, so going back is one click.
          </span>
        </h3>
      </div>
      <div className="l-panel overflow-hidden rounded-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#23252a] px-5 py-3">
          <span className="flex">
            {["Form", "YAML"].map((t, i) => (
              <span key={t} className={`rounded px-3 py-1 text-[12px] ${i === 1 ? "bg-[#23252a] text-white" : "text-[#8a8f98]"}`}>{t}</span>
            ))}
          </span>
          <span className="l-mono text-[11px] text-[#62666d]">warden.yml · version 7</span>
        </div>
        <div className="l-mono px-5 py-3.5 text-[12px] leading-[1.8]">
          {TRAEFIK_YAML.map((l, i) => (
            <div key={i} className="flex gap-4 whitespace-pre">
              <span className="w-4 shrink-0 text-right text-[#383b3f] select-none">{i + 1}</span>
              <span className="overflow-hidden text-ellipsis whitespace-pre text-[#d0d6e0]">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-[#23252a] px-5 py-3.5">
          {PROXY_CHECKS.map((c) => (
            <span key={c} className="flex items-center gap-2 text-xs text-[#8a8f98]">
              <span style={{ color: TONE.good }}>
                <CheckIcon size={12} />
              </span>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FleetSection() {
  return (
    <section id="fleet" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-32">
        <SectionIntro
          eyebrow="05 — SERVERS"
          title="Every server."
          sub="One console."
          body="Add any Linux VPS over SSH with a host, a user and a key. Every 60 seconds Warden reads CPU, memory, disk and the containers running on each one. Docker cleanup clears old images and build cache, and never touches your volumes."
        />
        <div className="l-mask-x relative -mx-6 flex max-h-[440px] justify-center gap-4 overflow-hidden pt-2">
          {FLEET.map((s) => <ServerCard key={s.host} s={s} />)}
          <div className="l-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40" />
        </div>
        <ProxyEditor />
      </div>
    </section>
  );
}
