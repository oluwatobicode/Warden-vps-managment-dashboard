import { z } from "zod";
import { slugName } from "./field.js";
import { variableKey } from "./variable.js";
import { BackupSettingsSchema } from "./backup.js";

/*
 * Databases as a service (Phase 1, decided 2026-10-15/21). Everything about
 * each engine lives in ONE catalog, so the api, worker and UI never disagree.
 * Adding a version (e.g. Postgres 19 once it's final) = one line here.
 */

export const DatabaseEngineSchema = z.enum(["POSTGRES", "MYSQL", "REDIS"]);
export type DatabaseEngine = z.infer<typeof DatabaseEngineSchema>;

export interface EngineSpec {
  label: string;
  /** Newest first; the first is the default. Each is an official Docker Hub tag. */
  versions: readonly string[];
  /** Docker Hub image name (the tag is the version). */
  image: string;
  /** Port inside the private network. Never published to the host. */
  port: number;
  /** Name of the auto-created variable holding the connection string. */
  defaultVariable: string;
  /** Rough memory at idle, for the "not enough room on this server" warning. */
  idleMemoryMb: number;
  /**
   * Where the volume is mounted. A function because Postgres 18+ moved it:
   * mounting 18 at the old /var/lib/postgresql/data makes the container fail.
   */
  dataPath: (version: string) => string;
}

export const DATABASE_CATALOG: Record<DatabaseEngine, EngineSpec> = {
  POSTGRES: {
    label: "PostgreSQL",
    versions: ["18", "17", "16"],
    image: "postgres",
    port: 5432,
    defaultVariable: "DATABASE_URL",
    idleMemoryMb: 100,
    dataPath: (v) => (Number(v) >= 18 ? "/var/lib/postgresql" : "/var/lib/postgresql/data"),
  },
  MYSQL: {
    // Only the two lines still getting security fixes (8.0 ended April 2026;
    // the newer "Innovation" releases are supported for one quarter only).
    label: "MySQL",
    versions: ["9.7", "8.4"],
    image: "mysql",
    port: 3306,
    defaultVariable: "DATABASE_URL",
    idleMemoryMb: 400,
    dataPath: () => "/var/lib/mysql",
  },
  REDIS: {
    label: "Redis",
    versions: ["8.10", "8.8", "8.6"],
    image: "redis",
    port: 6379,
    defaultVariable: "REDIS_URL",
    idleMemoryMb: 20,
    dataPath: () => "/data",
  },
};

/** POST /databases */
export const CreateDatabaseSchema = z
  .object({
    environmentId: z.uuid(),
    serviceName: slugName,
    engine: DatabaseEngineSchema,
    version: z.string().trim().min(1, "Pick a version"),
    serverId: z.uuid("Pick a server"),
    variableName: variableKey,
  })
  .superRefine((d, ctx) => {
    if (!DATABASE_CATALOG[d.engine].versions.includes(d.version)) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message: `${DATABASE_CATALOG[d.engine].label} ${d.version} isn't offered. Pick one of ${DATABASE_CATALOG[d.engine].versions.join(", ")}`,
      });
    }
  });
export type CreateDatabaseInput = z.infer<typeof CreateDatabaseSchema>;

/** DELETE /databases/:serviceId : keeping the data is the default. */
export const DeleteDatabaseSchema = z
  .object({
    deleteData: z.boolean().default(false),
    /** Must equal the service name when deleteData is true. */
    confirmName: z.string().trim().optional(),
  });
export type DeleteDatabaseInput = z.infer<typeof DeleteDatabaseSchema>;

/** GET /databases/:serviceId : never includes a password. */
export const DatabaseInfoSchema = z.object({
  serviceId: z.string(),
  engine: DatabaseEngineSchema,
  version: z.string(),
  databaseName: z.string().nullable(),
  username: z.string().nullable(),
  /** The host other services use: the container's name on the private network. */
  host: z.string(),
  port: z.number().int(),
  containerName: z.string(),
  volumeName: z.string(),
  variableName: z.string(),
  backup: BackupSettingsSchema,
  /** The latest create/restart/restore, with its step-by-step history. */
  latestDeployment: z
    .object({
      id: z.string(),
      number: z.number().int(),
      status: z.string(),
      createdAt: z.iso.datetime(),
      finishedAt: z.iso.datetime().nullable(),
      history: z.array(z.object({ status: z.string(), message: z.string().nullable(), at: z.iso.datetime() })),
    })
    .nullable(),
});
export type DatabaseInfo = z.infer<typeof DatabaseInfoSchema>;

/** GET /databases/:serviceId/connection (audit-logged reveal). */
export const DatabaseConnectionSchema = z.object({ connectionString: z.string() });
export type DatabaseConnection = z.infer<typeof DatabaseConnectionSchema>;

/** BullMQ payload, api → worker. */
export const DatabaseJobSchema = z.object({
  action: z.enum(["provision", "restart", "remove"]),
  serviceId: z.uuid(),
  organizationId: z.uuid(),
  deploymentId: z.uuid().optional(),
  deleteData: z.boolean().optional(),
});
export type DatabaseJob = z.infer<typeof DatabaseJobSchema>;
