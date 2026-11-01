import { Link } from "react-router";
import { GITHUB_URL } from "../data";
import { ArrowIcon } from "./bits";

/** The last call: sign up to a hosted Warden, or run your own. */
export function CtaSection() {
  return (
    <section id="start" className="mx-auto max-w-[1200px] px-6 pt-[200px] pb-40">
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="m-0 max-w-[820px] text-[clamp(40px,5.4vw,64px)] leading-none font-semibold tracking-[-1.408px] text-balance text-white">
          Ship your first app today.
        </h2>
        <p className="m-0 max-w-[560px] text-xl leading-[1.33] tracking-[-0.24px] text-pretty text-[#8a8f98]">
          Sign up, connect a server you own and deploy a repo. Or run Warden yourself on your own VPS: the code is on GitHub.
        </p>
        <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className="flex items-center gap-2.5 rounded-[2px] bg-[#e5e5e6] px-[22px] py-3 text-[15px] font-[510] whitespace-nowrap text-[#08090a] hover:bg-white">
            Get started <ArrowIcon size={14} strokeWidth={2.2} />
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-[#161718] px-[18px] py-2.5 text-[15px] font-[510] whitespace-nowrap text-[#e5e5e6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.6)] hover:bg-[#23252a] hover:text-white"
          >
            Self-host it
          </a>
        </div>
      </div>
    </section>
  );
}
