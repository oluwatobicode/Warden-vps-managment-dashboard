import type { Service, ServiceType } from "shared-types";

export const TYPE_LABEL: Record<ServiceType, string> = {
  APPLICATION: "Application",
  WORKER: "Worker",
  DATABASE: "Database",
  COMPOSE: "Docker Compose",
};

export function sourceLabel(
  s: Pick<Service, "githubRepoUrl" | "image">,
): string {
  if (s.githubRepoUrl)
    return s.githubRepoUrl
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "");
  return s.image ?? "no source";
}
