import { STACK, type StackItem } from "../data";
import dockerLogo from "devicon/icons/docker/docker-original.svg";
import { Eyebrow } from "./bits";

/** The language's logo in its colour; greyed out when we haven't deployed it ourselves yet. */
function Tile({ item }: { item: StackItem }) {
  return (
    <div className={`l-hair flex items-center gap-3.5 rounded-xl bg-[#0f1011] px-4 py-3.5 ${item.tested ? "" : "opacity-55"}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#161718]">
        <img src={item.logo} alt="" width={28} height={28} className={`size-7 ${item.invert ? "invert" : ""} ${item.tested ? "" : "grayscale"}`} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] text-[#e5e5e6]">{item.name}</span>
        <span className="text-xs text-[#62666d]">{item.tested ? "Deployed and tested" : "Detected, should work"}</span>
      </span>
    </div>
  );
}

export function StackSection() {
  return (
    <section id="stack" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-16 px-6 pt-32">
        <div className="flex flex-col gap-5">
          <Eyebrow>03 — WHAT YOU CAN DEPLOY</Eyebrow>
          <h2 className="m-0 max-w-[1100px] text-[clamp(32px,4.2vw,48px)] leading-[1.08] font-semibold tracking-[-1.056px] text-pretty text-white">
            Bring the repo you already have.{" "}
            <span className="text-[#8a8f98]">Your Dockerfile if there is one. If not, Railpack works out how to build it.</span>
          </h2>
          <p className="m-0 max-w-[720px] text-[17px] leading-[1.6] text-pretty text-[#8a8f98]">
            Monorepos work too: Warden finds each app in pnpm, npm or Yarn workspaces and builds it with Turborepo when the repo uses it. Apps in folders side by side, like <span className="l-mono text-[15px] text-[#d0d6e0]">backend/</span> and{" "}
            <span className="l-mono text-[15px] text-[#d0d6e0]">frontend/</span>, each become their own service.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
          {STACK.map((s) => <Tile key={s.name} item={s} />)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#161718] pt-6">
          <span className="flex items-center gap-2.5 text-[17px] text-[#e5e5e6]">
            <img src={dockerLogo} alt="" width={24} height={24} className="size-6" />
            Got a Dockerfile? <span className="text-[#8a8f98]">Any language works.</span>
          </span>
          <span className="text-[15px] text-[#62666d]">Or skip the build and run any public Docker image.</span>
        </div>
      </div>
    </section>
  );
}
