import { z } from "zod";
import { slugName } from "./field.js";
import { variableKey } from "./variable.js";
import { BackupSettingsSchema } from "./backup.js";

export const DatabaseEngineSchema = z.enum(["POSTGRES", "MYSQL", "REDIS"]);
export type DatabaseEngine = z.infer<typeof DatabaseEngineSchema>;

export interface EngineSpec {
  label: string;
  versions: readonly string[];
  image: string;
  port: number;
  defaultVariable: string;
  idleMemoryMb: number;
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
    dataPath: (v) =>
      Number(v) >= 18 ? "/var/lib/postgresql" : "/var/lib/postgresql/data",
  },
  MYSQL: {
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

export const CreateDatabaseSchema = z
  .object({
    environmentId: z.uuid(),
    serviceName: slugName,
    engine: DatabaseEngineSchema,
    version: z.string().trim().min(1, "Pick a version"),
    /** Absent = the environment's default server. */
    serverId: z.uuid("Pick a server").optional(),
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

export const DeleteDatabaseSchema = z.object({
  deleteData: z.boolean().default(false),
  confirmName: z.string().trim().optional(),
});
export type DeleteDatabaseInput = z.infer<typeof DeleteDatabaseSchema>;

export const DatabaseInfoSchema = z.object({
  serviceId: z.string(),
  engine: DatabaseEngineSchema,
  version: z.string(),
  databaseName: z.string().nullable(),
  username: z.string().nullable(),
  host: z.string(),
  port: z.number().int(),
  containerName: z.string(),
  volumeName: z.string(),
  variableName: z.string(),
  backup: BackupSettingsSchema,
  latestDeployment: z
    .object({
      id: z.string(),
      number: z.number().int(),
      status: z.string(),
      createdAt: z.iso.datetime(),
      finishedAt: z.iso.datetime().nullable(),
      history: z.array(
        z.object({
          status: z.string(),
          message: z.string().nullable(),
          at: z.iso.datetime(),
        }),
      ),
    })
    .nullable(),
});
export type DatabaseInfo = z.infer<typeof DatabaseInfoSchema>;

export const DatabaseConnectionSchema = z.object({
  connectionString: z.string(),
});
export type DatabaseConnection = z.infer<typeof DatabaseConnectionSchema>;

export const DatabaseJobSchema = z.object({
  action: z.enum(["provision", "restart", "remove"]),
  serviceId: z.uuid(),
  organizationId: z.uuid(),
  deploymentId: z.uuid().optional(),
  deleteData: z.boolean().optional(),
});
export type DatabaseJob = z.infer<typeof DatabaseJobSchema>;
