import { useState } from "react";
import { Link } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Logout03Icon, Search01Icon, UserSettings01Icon } from "@hugeicons/core-free-icons";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLogout } from "../../features/auth/hooks/useLogout";
import { ROLE_LABEL } from "../../utils/roles";
import { UserAvatar } from "../../features/account/components/UserAvatar";

// ⌘ on a Mac, Ctrl elsewhere: show the key people will actually press.
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Top bar inside a project (ATLINIX-style): page title · search · action · account. */
export function ProjectNavbar({ title, onSearch }: { title: string; onSearch: () => void }) {
  const { user } = useAuth();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = user ? `${user.firstName} ${user.lastName}` : "";

  return (
    <header className="flex shrink-0 items-center justify-between gap-5 rounded-[20px] border border-divider bg-surface px-5 py-3">
      <h1 className="min-w-0 truncate font-display text-base font-bold tracking-[-0.32px] text-strong">{title}</h1>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onSearch}
          className="hidden cursor-pointer items-center gap-[9px] rounded-xl border border-cb bg-field px-[13px] py-[9px] hover:border-fieldb lg:flex"
        >
          <HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.5} className="text-sand" />
          <span className="text-[12.5px] text-sand">Search services, projects, servers…</span>
          <kbd className="rounded-md border border-fieldb px-1.5 py-px font-sans text-[10px] text-faint">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>


        <span className="hidden h-7 w-px bg-fieldb sm:block" />

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-2"
          >
            <UserAvatar avatar={user?.avatar} name={name} size={30} />
            <span className="hidden flex-col items-start whitespace-nowrap md:flex">
              <span className="text-xs leading-tight font-medium text-strong">{name}</span>
              <span className="text-[10px] leading-tight text-sand">{user ? ROLE_LABEL[user.role] : ""}</span>
            </span>
            <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={1.5} className="shrink-0 text-sand" />
          </button>

          {menuOpen && (
            <>
              {/* Catches the click that closes the menu. */}
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
              <div role="menu" className="absolute right-0 z-50 mt-2 w-[230px] overflow-hidden rounded-xl border border-cb bg-card shadow-[0_8px_24px_rgba(0,0,0,.45)]">
                <div className="border-b border-cb px-3.5 py-[11px]">
                  <p className="m-0 truncate text-xs text-strong">{user?.organization.name}</p>
                  <p className="m-0 mt-0.5 truncate text-[10.5px] text-sand">{user?.email}</p>
                </div>
                <Link
                  to="/account"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-[9px] px-3.5 py-[11px] text-left text-[12.5px] text-body hover:bg-hover"
                >
                  <HugeiconsIcon icon={UserSettings01Icon} size={15} strokeWidth={1.5} />
                  <span className="flex-1 whitespace-nowrap">Account settings</span>
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  disabled={logout.isPending}
                  onClick={() => {
                    setMenuOpen(false);
                    logout.mutate();
                  }}
                  className="flex w-full cursor-pointer items-center gap-[9px] border-t border-cb px-3.5 py-[11px] text-left text-[12.5px] text-muted-deep hover:bg-hover disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Logout03Icon} size={15} strokeWidth={1.5} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
