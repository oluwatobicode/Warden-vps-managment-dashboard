import { Link } from "react-router";
import { NAV_LINKS } from "../data";
import { ChevronIcon, ShieldIcon } from "./bits";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-10 bg-[linear-gradient(#08090a_60%,rgba(8,9,10,0))] px-6 pt-2.5">
      <nav className="mx-auto grid max-w-[1200px] grid-cols-[max-content_1fr] md:grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center gap-4 border border-[#23252a] bg-[rgba(22,23,24,0.88)] py-2 pr-2 pl-4 backdrop-blur-[16px]">
        <a href="#top" className="flex w-max items-center gap-2.5 text-white">
          <ShieldIcon className="text-[#e5e5e6]" />
          <span className="text-[19px] font-semibold tracking-[-0.3px]">Warden</span>
        </a>
        <div className="hidden max-h-10 min-w-0 flex-wrap md:flex items-center justify-center overflow-hidden">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="flex items-center gap-1.5 px-3.5 py-2 text-[15px] whitespace-nowrap text-[#d0d6e0] hover:text-white">
              {l.label}
              {l.menu && <ChevronIcon />}
            </a>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Link to="/login" className="border border-[#383b3f] bg-[#0f1011] px-[18px] py-2.5 text-[15px] whitespace-nowrap text-[#e5e5e6] hover:border-[#62666d] hover:text-white">
            Log in
          </Link>
          <Link to="/signup" className="hidden bg-[#e5e5e6] sm:block px-5 py-[11px] text-[15px] font-[510] whitespace-nowrap text-[#08090a] hover:bg-white">
            Start deploying
          </Link>
        </div>
      </nav>
    </header>
  );
}
