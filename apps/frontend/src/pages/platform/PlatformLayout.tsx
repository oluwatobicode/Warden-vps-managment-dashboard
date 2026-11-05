import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity03Icon,
  ArrowLeft01Icon,
  Building03Icon,
  ChartIncreaseIcon,
  DashboardSquare01Icon,
  FilterHorizontalIcon,
  Rocket01Icon,
  ServerStack01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/Button";
import { LogoMark } from "../../components/ui/WardenMark";
import { ProjectNavbar } from "../../components/layout/ProjectNavbar";
import { timeAgo } from "../../utils/formatDate";
import { platformKeys, usePlatformHealth, usePlatformOverview, usePlatformUser } from "../../features/platform/hooks/usePlatform";

const NAV = [
  { to: "/platform", label: "Overview", icon: DashboardSquare01Icon, end: true },
  { to: "/platform/growth", label: "Growth", icon: ChartIncreaseIcon, end: false },
  { to: "/platform/activation", label: "Activation", icon: FilterHorizontalIcon, end: false },
  { to: "/platform/deploys", label: "Deploys", icon: Rocket01Icon, end: false },
  { to: "/platform/infrastructure", label: "Infrastructure", icon: ServerStack01Icon, end: false },
  { to: "/platform/orgs", label: "Organizations", icon: Building03Icon, end: false },
  { to: "/platform/users", label: "Users", icon: UserMultiple02Icon, end: false },
  { to: "/platform/health", label: "Warden health", icon: Activity03Icon, end: false },
];

/**
 * /platform/* : the platform owner's pages, in the same shell as a project
 * (sidebar + navbar). Lazy route, so Recharts never ships in the main bundle.
 * RequirePlatformOwner only hides it; the api's PlatformOwnerGuard is the real check.
 */
export default function PlatformLayout() {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const onHealth = pathname.startsWith("/platform/health");
  const onUsers = pathname.startsWith("/platform/users");
  const userId = useMatch("/platform/users/:id")?.params.id;
  // Only the query the page shows decides "updated …"; both refresh together.
  // The users pages read neither (their own queries, same cache key root).
  const overview = usePlatformOverview(!onHealth && !onUsers);
  const health = usePlatformHealth(onHealth);
  // A user's page is titled with their name; this is the same cached query the page reads.
  const user = usePlatformUser(userId ?? "", Boolean(userId));
  const shown = onUsers ? undefined : onHealth ? health.data : overview.data;
  const refreshing = qc.isFetching({ queryKey: platformKeys.all }) > 0;
  const title = userId
    ? user.data?.name || "User"
    : (NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? "Overview");

  return (
    <div className="flex h-screen-ui gap-[13px] overflow-hidden p-4">
      <aside className="flex w-[252px] shrink-0 flex-col gap-3.5 overflow-y-auto rounded-[22px] border border-divider bg-ink py-[13px]">
        <div className="px-3">
          <div className="mt-2 flex items-center gap-2.5 rounded-[18px] border border-navb bg-raised px-3 py-[11px]">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-nav text-strong">
              <LogoMark size={11} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-medium text-white">Warden platform</span>
              <span className="truncate text-[10px] text-muted">Owner · every organization</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-3 pt-1">
          <Link to="/home" className="flex items-center gap-[9px] px-2.5 py-1.5 text-[11.5px] text-muted-warm hover:text-white">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={1.5} />
            Back to the console
          </Link>

          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] ${isActive ? "bg-[#24262c] text-white" : "text-[#7c8088] hover:text-white"}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-1/2 left-0 h-[18px] w-[3px] -translate-y-1/2 rounded-r-[3px] bg-strong" />}
                    <HugeiconsIcon icon={n.icon} size={17} strokeWidth={1.5} />
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <p className="mx-3 mt-auto mb-0.5 border-t border-cb pt-[13px] pl-1 text-[9.5px] text-[#45454b]">Warden · platform</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-[13px]">
        <ProjectNavbar
          title={title}
          actions={
            <div className="flex items-center gap-3">
              {shown && <span className="hidden text-xs whitespace-nowrap text-sand md:inline">updated {timeAgo(shown.generatedAt)}</span>}
              <Button variant="secondary" loading={refreshing} onClick={() => qc.invalidateQueries({ queryKey: platformKeys.all })} className="px-3.5 py-2 text-xs">
                Refresh
              </Button>
            </div>
          }
        />
        <main className="flex min-h-0 min-w-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto rounded-[20px] border border-divider bg-surface px-[30px] py-[26px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
