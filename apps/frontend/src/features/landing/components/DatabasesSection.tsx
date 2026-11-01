import { BACKUPS, DATABASES } from "../data";
import { CheckIcon, Dot, SectionIntro } from "./bits";
import { TONE } from "../tone";

export function DatabasesSection() {
  return (
    <section id="databases" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-32">
        <SectionIntro
          eyebrow="04 — DATABASES & BACKUPS"
          title="Databases next to your apps."
          sub="Backed up every day."
          body="Start Postgres, MySQL or Redis on the same server as your app. It runs on the environment’s private Docker network and is never published to the internet. Its connection string is added to the environment as a secret variable, ready for your app."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-start gap-4">
          {/* engines and versions */}
          <div className="l-panel rounded-xl">
            <div className="border-b border-[#23252a] px-5 py-3.5 text-sm font-[590] text-[#e5e5e6]">Add a database</div>
            <div className="flex flex-col gap-2 p-3">
              {DATABASES.map((d) => (
                <div key={d.engine} className="flex flex-col gap-3 rounded-lg bg-[#161718] px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <img src={d.logo} alt="" width={20} height={20} className="size-5" />
                    <span className="text-[15px] text-[#e5e5e6]">{d.engine}</span>
                    <span className="l-mono ml-auto text-[11px] text-[#62666d]">{d.variable}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.versions.map((v, i) => (
                      <span key={v} className={`l-mono rounded px-2 py-0.5 text-[11px] ${i === 0 ? "bg-[#23252a] text-[#e5e5e6]" : "l-hair text-[#8a8f98]"}`}>
                        {v}
                        {i === 0 && <span className="text-[#62666d]"> · default</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 px-1 pt-1 text-xs text-[#62666d]">
                <Dot tone={TONE.good} />
                Private network only · data kept in a named volume
              </div>
            </div>
          </div>

          {/* nightly backups */}
          <div className="l-panel mt-10 rounded-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#23252a] px-5 py-3.5">
              <span className="text-sm font-[590] text-[#e5e5e6]">
                Backups <span className="font-normal text-[#62666d]">postgres · production</span>
              </span>
              <span className="text-xs text-[#62666d]">Daily 02:00 UTC · keep 7 days</span>
            </div>
            <div className="flex flex-col gap-1.5 p-3">
              {BACKUPS.map(([when, size]) => (
                <div key={when} className="flex items-center gap-3 rounded-md bg-[#161718] px-3 py-2.5">
                  <span className="grid size-[18px] place-items-center" style={{ color: TONE.good }}>
                    <CheckIcon size={13} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[#e5e5e6]">{when}</span>
                  <span className="l-mono shrink-0 text-[11px] text-[#62666d]">{size}</span>
                  <span className="hidden shrink-0 gap-1.5 sm:flex">
                    <span className="l-hair rounded px-[7px] py-0.5 text-[11px] text-[#8a8f98]">Download</span>
                    <span className="l-hair rounded px-[7px] py-0.5 text-[11px] text-[#8a8f98]">Restore</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mx-3 mb-3 rounded-lg bg-[#08090a] px-3.5 py-3 text-xs leading-normal text-[#8a8f98] shadow-[inset_0_0_0_1px_#23252a]">
              Streamed from the server, encrypted with AES-256-GCM and uploaded to your own S3 or R2 bucket. A restore checks the file hasn’t been tampered with before it touches your data.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
