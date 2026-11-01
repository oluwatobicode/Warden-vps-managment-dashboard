import { Link } from "react-router";
import { GITHUB_URL } from "../data";

const ANCHORS = [
  ["#stack", "What you can deploy"],
  ["#changelog", "Changelog"],
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-7">
        <span className="text-[13px] text-[#62666d]">© {new Date().getFullYear()} Warden</span>
        <span className="text-[13px] text-[#62666d]">Warden uses cookies only to keep you signed in</span>
        <div className="flex flex-wrap gap-5">
          {ANCHORS.map(([href, label]) => (
            <a key={label} href={href} className="text-[13px] text-[#8a8f98] hover:text-[#e5e5e6]">
              {label}
            </a>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-[13px] text-[#8a8f98] hover:text-[#e5e5e6]">
            GitHub
          </a>
          <Link to="/login" className="text-[13px] text-[#8a8f98] hover:text-[#e5e5e6]">
            Log in
          </Link>
        </div>
      </div>
    </footer>
  );
}
