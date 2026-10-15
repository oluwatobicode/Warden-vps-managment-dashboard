import { useState } from "react";
import toast from "react-hot-toast";
import { INSTALL_COMMAND } from "../data";

export function InstallSection() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select the command and copy it by hand.");
    }
  };

  return (
    <section id="install" className="mx-auto max-w-[1200px] px-6 pt-[200px] pb-40">
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="m-0 max-w-[820px] text-[clamp(40px,5.4vw,64px)] leading-none font-semibold tracking-[-1.408px] text-balance text-white">
          Your first deploy is ten minutes away.
        </h2>
        <p className="m-0 max-w-[540px] text-xl leading-[1.33] tracking-[-0.24px] text-pretty text-[#8a8f98]">
          One command installs Warden, Docker and Traefik. Open the console on port 3000 and connect your first app.
        </p>
        <div className="mt-2 flex max-w-full min-w-[min(100%,400px)] items-center justify-between gap-4 rounded-md bg-[#0f1011] py-2 pr-2 pl-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.6)]">
          <code className="l-mono min-w-0 flex-1 truncate text-left text-sm text-[#d0d6e0]">
            <span className="text-[#62666d]">$ </span>
            {INSTALL_COMMAND}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className="shrink-0 cursor-pointer rounded border-none bg-[#23252a] px-2.5 py-1.5 text-xs text-[#e5e5e6] hover:bg-[#383b3f]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex w-full flex-wrap items-center justify-center gap-3">
          <a href="#docs" className="rounded-[2px] bg-[#e5e5e6] px-[22px] py-3 text-[15px] font-[510] whitespace-nowrap text-[#08090a] hover:bg-white">
            Read the install guide
          </a>
          <a
            href="#github"
            className="rounded-md bg-[#161718] px-[18px] py-2.5 text-[15px] font-[510] whitespace-nowrap text-[#e5e5e6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.6)] hover:bg-[#23252a] hover:text-white"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
