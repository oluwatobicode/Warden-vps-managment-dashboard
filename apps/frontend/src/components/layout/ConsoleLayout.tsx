import { NavLink, Outlet, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLogout } from "../../features/auth/hooks/useLogout";
import { ROLE_LABEL } from "../../utils/roles";

const TABS = [
  { to: "/home", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/settings", label: "Settings" },
];

/** Org card · Home / Projects / Settings · Logout, then the page. */
export function ConsoleLayout() {
  const { user } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        navigate("/login", { replace: true });
        toast.success("Logged out");
      },
    });

  return (
    <div className="flex min-h-dvh flex-col px-[clamp(20px,6vw,96px)] pt-7 pb-12">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
        <div className="flex items-center gap-[13px] justify-self-start rounded-2xl border border-cb bg-ink py-3.5 pr-[22px] pl-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-good-s text-[13px] font-bold text-good">
            {initials(user?.organization.name ?? "")}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold text-strong">{user?.organization.name}</span>
            <span className="font-mono text-[11px] text-sand">{user ? ROLE_LABEL[user.role] : ""}</span>
          </span>
        </div>

        <nav className="flex rounded-3xl border border-cb bg-ink p-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-[20px] px-[18px] py-[9px] text-[12.5px] font-semibold transition-colors ${
                  isActive ? "bg-nav text-strong" : "text-muted-warm hover:text-strong"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          disabled={logout.isPending}
          className="cursor-pointer justify-self-end rounded-3xl border border-[#2e2e2e] px-[22px] py-3 text-[13px] font-semibold text-strong hover:bg-raised disabled:opacity-50"
        >
          Logout
        </button>
      </header>

      <div className="mt-[26px] mb-11 h-px bg-cb" />
      <Outlet />
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
