import { NavLink, Outlet } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudUploadIcon, GithubIcon, Key01Icon, Notification01Icon, ServerStack01Icon, SquareLock02Icon, Task01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useServers } from "../../features/servers/hooks/useServers";
import { useSshKeys } from "../../features/ssh-keys/hooks/useSshKeys";
import { atLeast } from "../../utils/roles";

/** Settings: left menu + the selected page, inside the console top bar. */
export function SettingsLayout() {
  const { user } = useAuth();
  const servers = useServers();
  const keys = useSshKeys();
  const items = [
    { to: "/settings/servers", label: "Remote servers", icon: ServerStack01Icon, badge: servers.data?.length },
    { to: "/settings/ssh-keys", label: "SSH keys", icon: Key01Icon, badge: keys.data?.length },
    { to: "/settings/github", label: "GitHub", icon: GithubIcon },
    { to: "/settings/backup-storage", label: "Backup storage", icon: CloudUploadIcon },
    { to: "/settings/team", label: "Team & roles", icon: UserGroupIcon },
    { to: "/settings/notifications", label: "Notifications", icon: Notification01Icon },
    // The token list is ADMIN-only on the API, so the page is too.
    ...(atLeast(user?.role, "ADMIN")
      ? [
          { to: "/settings/tokens", label: "API tokens", icon: SquareLock02Icon },
          // Admin-only on the API too: the log can show who revealed which secret.
          { to: "/settings/audit-log", label: "Audit log", icon: Task01Icon },
        ]
      : []),
  ];

  return (
    <div className="-mt-2.5 grid flex-1 grid-cols-[236px_minmax(0,1fr)] items-start gap-5">
      <nav className="sticky top-5 flex flex-col gap-0.5" aria-label="Settings">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-[11px] rounded-[11px] px-[13px] py-[11px] text-[12.5px] font-semibold ${isActive ? "bg-[#24262c] text-white" : "text-[#7c8088] hover:text-strong"}`
            }
          >
            <HugeiconsIcon icon={n.icon} size={14} strokeWidth={1.5} />
            <span className="flex-1">{n.label}</span>
            {n.badge !== undefined && n.badge > 0 && <span className="rounded-[10px] bg-[#31343a] px-1.5 py-px text-[9.5px] text-muted-warm">{n.badge}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="min-h-[70vh] rounded-[20px] border border-divider bg-surface px-[30px] py-[26px]">
        <Outlet />
      </div>
    </div>
  );
}
