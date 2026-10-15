import { useMemo } from "react";
import type { Environment, ProjectDetail } from "shared-types";
import { useProjects } from "../../projects/hooks/useProjects";
import { useServers } from "../../servers/hooks/useServers";
import { useServices } from "../../services/hooks/useServices";

export type JumpKind = "page" | "project" | "service" | "server";

export interface JumpTarget {
  id: string;
  kind: JumpKind;
  label: string;
  sub: string;
  to: string;
}

/**
 * Everything ⌘K can jump to, from data the app already loads: no search API.
 * Services are the current environment's (the only ones in the cache).
 */
export function useJumpTargets({ project, env }: { project: ProjectDetail; env: Environment | undefined }): JumpTarget[] {
  const projects = useProjects();
  const servers = useServers();
  const services = useServices(env?.id);

  return useMemo(() => {
    const q = env ? `?env=${env.id}` : "";
    const base = `/projects/${project.id}`;
    const pages: JumpTarget[] = [
      { id: "p-overview", kind: "page", label: "Overview", sub: project.projectName, to: base + q },
      { id: "p-vars", kind: "page", label: "Variables", sub: `${project.projectName} · ${env?.environmentName ?? ""}`, to: `${base}/variables${q}` },
      { id: "p-settings", kind: "page", label: "Project settings", sub: project.projectName, to: `${base}/settings${q}` },
      { id: "g-projects", kind: "page", label: "All projects", sub: "Console", to: "/projects" },
      { id: "g-servers", kind: "page", label: "Remote servers", sub: "Settings", to: "/settings/servers" },
      { id: "g-keys", kind: "page", label: "SSH keys", sub: "Settings", to: "/settings/ssh-keys" },
      { id: "g-team", kind: "page", label: "Team & roles", sub: "Settings", to: "/settings/team" },
      { id: "g-notif", kind: "page", label: "Notifications", sub: "Settings", to: "/settings/notifications" },
    ];
    return [
      ...pages,
      ...(services.data ?? []).map((s) => ({
        id: `s-${s.id}`,
        kind: "service" as const,
        label: s.serviceName,
        sub: `${project.projectName} · ${env?.environmentName ?? ""}`,
        to: `${base}/services/${s.id}${q}`,
      })),
      ...(projects.data ?? [])
        .filter((p) => p.id !== project.id)
        .map((p) => ({ id: `pr-${p.id}`, kind: "project" as const, label: p.projectName, sub: `/${p.slug}`, to: `/projects/${p.id}` })),
      ...(servers.data ?? []).map((s) => ({
        id: `sv-${s.id}`,
        kind: "server" as const,
        label: s.serverName,
        sub: `${s.serverIp} · ${s.serverType === "BUILD" ? "build" : "deploy"} server`,
        to: `/settings/servers/${s.id}`,
      })),
    ];
  }, [project, env, projects.data, servers.data, services.data]);
}
