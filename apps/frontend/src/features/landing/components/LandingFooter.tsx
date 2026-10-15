const LINKS = [
  ["#docs", "Docs"],
  ["#changelog", "Changelog"],
  ["#status", "Status"],
  ["#github", "GitHub"],
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-7">
        <span className="text-[13px] text-[#62666d]">© 2026 Warden</span>
        <div className="flex flex-wrap gap-5">
          {LINKS.map(([href, label]) => (
            <a key={label} href={href} className="text-[13px] text-[#8a8f98] hover:text-[#e5e5e6]">
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
