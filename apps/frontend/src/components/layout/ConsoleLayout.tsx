import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLogout } from "../../features/auth/hooks/useLogout";
import { ROLE_LABEL } from "../../utils/roles";
import { UserAvatar } from "../../features/account/components/UserAvatar";

const TABS = [
  { to: "/home", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/settings", label: "Settings" },
];

export function ConsoleLayout() {
  const { user } = useAuth();
  const logout = useLogout();

  const onLogout = () => logout.mutate();

  return (
    <div className="flex min-h-screen-ui flex-col pt-7 pb-12">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 px-[var(--page-x)]">
        <div className="flex max-w-[260px] items-center gap-2.5 justify-self-start rounded-xl border border-cb bg-ink py-2 pr-4 pl-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-good-s text-[10.5px] font-bold text-good">
            {initials(user?.organization.name ?? "")}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[12.5px] leading-tight font-semibold text-strong">
              {user?.organization.name}
            </span>
            <span className="font-mono text-[10px] leading-tight text-sand">
              {user ? ROLE_LABEL[user.role] : ""}
            </span>
          </span>
        </div>

        <nav className="flex rounded-3xl border border-cb bg-ink p-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-[20px] px-[18px] py-[9px] text-[12.5px] font-semibold transition-colors ${
                  isActive
                    ? "bg-nav text-strong"
                    : "text-muted-warm hover:text-strong"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          <Link to="/account" aria-label="Account settings" title="Account settings" className="rounded-full ring-2 ring-transparent hover:ring-fieldb">
            <UserAvatar avatar={user?.avatar} name={user ? `${user.firstName} ${user.lastName}` : ""} size={38} />
          </Link>
          <button
            type="button"
            onClick={onLogout}
            disabled={logout.isPending}
            className="cursor-pointer rounded-3xl border border-[#2e2e2e] px-[22px] py-3 text-[13px] font-semibold text-strong hover:bg-raised disabled:opacity-50"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Full width on purpose: the line runs edge to edge, the content doesn't. */}
      <div className="mt-[26px] mb-11 h-px bg-cb" />
      <div className="flex flex-1 flex-col px-[var(--page-x)]">
        <Outlet />
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
