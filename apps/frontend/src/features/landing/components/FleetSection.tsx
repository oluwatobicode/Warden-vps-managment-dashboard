import { FLEET, type FleetServer } from "../data";
import { Dot, Meter, SectionIntro } from "./bits";

function ServerCard({ s }: { s: FleetServer }) {
  return (
    <div className="l-panel flex flex-[0_0_300px] flex-col rounded-xl">
      <div className="flex items-center justify-between border-b border-[#23252a] px-4 py-3.5">
        <span className="flex items-center gap-2">
          <Dot tone={s.tone} size={7} />
          <span className="l-mono text-[13px] text-[#e5e5e6]">{s.host}</span>
          <span className="rounded bg-[#23252a] px-1.5 py-px text-[11px] text-[#8a8f98]">{s.role}</span>
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

export function FleetSection() {
  return (
    <section id="fleet" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-32">
        <SectionIntro
          eyebrow="03 — FLEET"
          title="Every server."
          sub="One console."
          body="Add any VPS over SSH with a host, a user and a key. Warden tracks CPU, memory and disk on each machine and keeps build servers separate from the ones serving traffic."
        />
        <div className="l-mask-x relative -mx-6 flex max-h-[440px] justify-center gap-4 overflow-hidden pt-2">
          {FLEET.map((s) => <ServerCard key={s.host} s={s} />)}
          <div className="l-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40" />
        </div>
      </div>
    </section>
  );
}
