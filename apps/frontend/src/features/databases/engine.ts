import { DATABASE_CATALOG, type DatabaseEngine, type Service } from "shared-types";

/** "postgres:18" → POSTGRES. A database service's image always names its engine. */
export function engineOf(service: Pick<Service, "type" | "image">): DatabaseEngine | null {
  if (service.type !== "DATABASE" || !service.image) return null;
  const name = service.image.split(":")[0];
  return (Object.keys(DATABASE_CATALOG) as DatabaseEngine[]).find((e) => DATABASE_CATALOG[e].image === name) ?? null;
}
