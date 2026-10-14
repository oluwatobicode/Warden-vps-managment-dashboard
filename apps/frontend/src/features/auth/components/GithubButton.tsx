import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";

export function GithubButton() {
  return (
    <a
      href={`${import.meta.env.VITE_API_URL}/auth/github`}
      className="mt-2.5 flex items-center justify-center gap-2.5 rounded-xl border border-fieldb bg-card p-3.5 text-[13px] font-semibold text-strong hover:bg-hover"
    >
      <HugeiconsIcon icon={GithubIcon} size={16} strokeWidth={1.7} />
      Continue with GitHub
    </a>
  );
}
