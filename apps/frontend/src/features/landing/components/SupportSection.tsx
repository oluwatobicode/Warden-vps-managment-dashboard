import { DOCS_URL, SUPPORT_EMAIL } from "../data";
import { ArrowIcon } from "./bits";

/** Before the footer: where to go when something's wrong. */
export function SupportSection() {
  return (
    <section id="support" className="mx-auto max-w-[1200px] px-6 pb-24">
      <div className="l-panel flex flex-col gap-6 rounded-[2px] px-8 py-9 md:flex-row md:items-center md:justify-between md:px-12">
        <div className="flex max-w-[560px] flex-col gap-2.5">
          <h2 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.6px] text-white">Facing an issue?</h2>
          <p className="m-0 text-[17px] leading-[1.5] text-pretty text-[#8a8f98]">
            Email us about a bug, a feature you need or a question, and a person replies. Signed in? Use <span className="text-[#d0d6e0]">Support</span> in the dashboard to attach screenshots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2.5 rounded-[2px] bg-[#e5e5e6] px-[22px] py-3 text-[15px] font-[510] whitespace-nowrap text-[#08090a] hover:bg-white"
          >
            Email support <ArrowIcon size={14} strokeWidth={2.2} />
          </a>
          <a
            href={DOCS_URL}
            className="rounded-[2px] bg-[#161718] px-[18px] py-3 text-[15px] font-[510] whitespace-nowrap text-[#e5e5e6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-[#23252a] hover:text-white"
          >
            Read the docs
          </a>
        </div>
      </div>
      <p className="l-mono mt-3 text-center text-[12px] tracking-[0.04em] text-[#62666d] md:text-left">{SUPPORT_EMAIL}</p>
    </section>
  );
}
