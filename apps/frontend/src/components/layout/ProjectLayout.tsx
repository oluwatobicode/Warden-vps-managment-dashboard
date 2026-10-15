import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useMatch, useParams, useSearchParams } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Home01Icon, Settings01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import type { Environment, ProjectDetail, ServiceStatus } from "shared-types";
import { useProject } from "../../features/projects/hooks/useProjects";
import { useEnvironments } from "../../features/environments/hooks/useEnvironments";
import { useAuth } from "../../features/auth/hooks/useAuth";
import type { ProjectContext } from "../../features/projects/hooks/useProjectContext";
import { useService } from "../../features/services/hooks/useServices";
import { AddServiceModal } from "../../features/services/components/AddServiceModal";
import { useJumpTargets } from "../../features/search/hooks/useJumpTargets";
import { CommandPalette } from "../../features/search/components/CommandPalette";
import { atLeast } from "../../utils/roles";
import { ProjectNavbar } from "./ProjectNavbar";
import { apiMessage, apiStatus } from "../../utils/apiMessage";
import { FullPageSpinner } from "../ui/Spinner";
import { ButtonLink } from "../ui/Button";

// Dot colour per status, for the environment switcher.
const DOT: Record<ServiceStatus, string> = {
  NOT_DEPLOYED: "bg-focus",
  DEPLOYING: "bg-brand",
  HEALTHY: "bg-good",
  DEGRADED: "bg-serious",
  FAILED: "bg-crit",
};

/** Inside a project: loads the project, then hands over to ProjectShell. */
export function ProjectLayout() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const project = useProject(projectId);
  const environments = useEnvironments(projectId);

  const envs = useMemo(() => environments.data ?? [], [environments.data]);
  const env = envs.find((e) => e.id === params.get("env")) ?? envs[0];

  if (project.isPending || environments.isPending) return <FullPageSpinner />;
  if (project.isError || environments.isError) {
    const missing = apiStatus(project.error) === 404;
    return (
      <div className="grid min-h-screen-ui place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-warm">{missing ? "This project doesn't exist, or it isn't in your organization." : apiMessage(project.error ?? environments.error)}</p>
          <ButtonLink variant="secondary" to="/projects">All projects</ButtonLink>
        </div>
      </div>
    );
  }

  const selectEnv = (id: string) =>
    setParams((p) => {
      p.set("env", id);
      return p;
    });
  return <ProjectShell project={project.data} envs={envs} env={env} selectEnv={selectEnv} />;
}

/**
 * Sidebar (back, environment switcher, nav) + navbar (title, ⌘K, Add service,
 * account) + the page. Owns the Add service modal so the navbar and the
 * Overview page open the same one.
 */
function ProjectShell({
  project,
  envs,
  env,
  selectEnv,
}: {
  project: ProjectDetail;
  envs: Environment[];
  env: Environment | undefined;
  selectEnv: (id: string) => void;
}) {
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const targets = useJumpTargets({ project, env });
  const base = `/projects/${project.id}`;
  const withEnv = (path: string) => (env ? `${path}?env=${env.id}` : path);
  const canAddService = atLeast(user?.role, "DEVELOPER") && !!env;
  const openAddService = () => setAdding(true);
  const context: ProjectContext = { project, environments: envs, env, selectEnv, withEnv, openAddService };

  // ⌘K / Ctrl-K toggles the palette from anywhere in the project.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setSearching((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The navbar title is the current page; on a service page, its name.
  const serviceMatch = useMatch("/projects/:projectId/services/:serviceId");
  const service = useService(serviceMatch?.params.serviceId ?? "", !!serviceMatch);
  const onVariables = useMatch("/projects/:projectId/variables");
  const onSettings = useMatch("/projects/:projectId/settings");
  const title = serviceMatch ? (service.data?.serviceName ?? "Service") : onVariables ? "Variables" : onSettings ? "Project settings" : "Overview";

  const nav = [
    { to: base, label: "Overview", icon: Home01Icon, end: true },
    { to: `${base}/variables`, label: "Variables", icon: SquareLock02Icon, end: false },
    { to: `${base}/settings`, label: "Settings", icon: Settings01Icon, end: false },
  ];

  return (
    <div className="flex h-screen-ui gap-[13px] overflow-hidden p-4">
      <aside className="flex w-[252px] shrink-0 flex-col gap-3.5 overflow-y-auto rounded-[22px] border border-divider bg-ink py-[13px]">
        <div className="px-3">
          <div className="mt-2 flex items-center gap-2.5 rounded-[18px] border border-navb bg-raised px-3 py-[11px]">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-nav font-display text-xs font-bold text-strong">
              {project.projectName.slice(0, 2).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-medium text-white">{project.projectName}</span>
              <span className="truncate text-[10px] text-muted">{env ? env.environmentName : "no environments"}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-3 pt-1">
          <Link to="/projects" className="flex items-center gap-[9px] px-2.5 py-1.5 text-[11.5px] text-muted-warm hover:text-white">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={1.5} />
            All projects
          </Link>

          {envs.length > 0 && (
            <div className="flex flex-col gap-[7px] rounded-[13px] border border-navb bg-raised px-3 py-[11px]">
              <span className="text-[9.5px] tracking-[.475px] text-muted">ENVIRONMENT</span>
              <div role="radiogroup" aria-label="Environment" className="flex flex-wrap gap-0.5 rounded-[9px] border border-navb bg-[#141414] p-[3px]">
                {envs.map((e) => {
                  const on = e.id === env?.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => selectEnv(e.id)}
                      className={`flex min-w-[64px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-1 py-1.5 ${on ? "bg-[#24262c] text-white" : "text-[#7c8088] hover:text-white"}`}
                    >
                      <span className={`size-[5px] rounded-full ${on ? DOT[e.status] : "bg-focus"}`} />
                      <span className="max-w-[90px] truncate text-[10.5px] font-semibold">{e.environmentName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <nav className="flex flex-col gap-0.5">
            {nav.map((n) => (
              <NavLink
                key={n.label}
                to={withEnv(n.to)}
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

        <p className="mx-3 mt-auto mb-0.5 border-t border-cb pt-[13px] pl-1 text-[9.5px] text-[#45454b]">Warden · self-hosted</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-[13px]">
        <ProjectNavbar title={title} onSearch={() => setSearching(true)} onAddService={canAddService ? openAddService : undefined} />
        <main className="flex min-h-0 min-w-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto rounded-[20px] border border-divider bg-surface px-[30px] py-[26px]">
            <Outlet context={context} />
          </div>
        </main>
      </div>

      {searching && <CommandPalette targets={targets} onClose={() => setSearching(false)} />}
      {env && <AddServiceModal open={adding} onClose={() => setAdding(false)} env={env} servicePath={(id) => withEnv(`${base}/services/${id}`)} />}
    </div>
  );
}
