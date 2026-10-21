import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import type { z } from "zod";
import { CreateDatabaseSchema, DATABASE_CATALOG, type CreateDatabaseInput, type DatabaseEngine, type Environment, type Service } from "shared-types";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import { Select } from "../../../components/ui/Select";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { formatBytes } from "../../../utils/formatBytes";
import { useServers } from "../../servers/hooks/useServers";
import { useServerMetrics } from "../../servers/hooks/useMonitoring";
import { useCreateDatabase } from "../hooks/useDatabases";

const ENGINES = (Object.keys(DATABASE_CATALOG) as DatabaseEngine[]).map((id) => ({
  id,
  label: DATABASE_CATALOG[id].label,
  detail: id === "REDIS" ? "Cache, queues" : id === "MYSQL" ? "Needs ~400 MB RAM" : "The usual choice",
}));
const NAME: Record<DatabaseEngine, string> = { POSTGRES: "postgres", MYSQL: "mysql", REDIS: "redis" };

/**
 * "Add service → Database". The form id is `add-database`, so the modal's
 * footer button can submit it. Warden starts the container on the chosen
 * server, on a private network (no public port), and creates the connection
 * string as a secret environment variable.
 */
export function DatabaseForm({ env, onCreated, onPending }: { env: Environment; onCreated: (s: Service) => void; onPending: (busy: boolean) => void }) {
  const servers = useServers();
  const create = useCreateDatabase();
  const deployServers = (servers.data ?? []).filter((s) => s.serverType === "DEPLOY");
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, dirtyFields },
  } = useForm<z.input<typeof CreateDatabaseSchema>, unknown, CreateDatabaseInput>({
    resolver: zodResolver(CreateDatabaseSchema),
    defaultValues: { environmentId: env.id, engine: "POSTGRES", version: DATABASE_CATALOG.POSTGRES.versions[0], serviceName: "postgres", variableName: "DATABASE_URL" },
  });
  const engine = useWatch({ control, name: "engine" }) as DatabaseEngine;
  const serverId = useWatch({ control, name: "serverId" });
  const spec = DATABASE_CATALOG[engine];

  useEffect(() => onPending(create.isPending), [create.isPending, onPending]);
  // Pick the first deploy server once the list arrives.
  useEffect(() => {
    if (!serverId && deployServers[0]) setValue("serverId", deployServers[0].id);
  }, [serverId, deployServers, setValue]);

  const pickEngine = (e: DatabaseEngine) => {
    setValue("engine", e);
    setValue("version", DATABASE_CATALOG[e].versions[0]);
    // Only replace the name and variable if the user hasn't typed their own.
    if (!dirtyFields.serviceName) setValue("serviceName", NAME[e]);
    if (!dirtyFields.variableName) setValue("variableName", DATABASE_CATALOG[e].defaultVariable);
  };

  const metrics = useServerMetrics(serverId ?? "");
  const freeBytes = metrics.data?.memory ? metrics.data.memory.totalBytes - metrics.data.memory.usedBytes : null;
  const tight = freeBytes !== null && freeBytes < spec.idleMemoryMb * 1024 * 1024;
  const versionOptions = useMemo(() => spec.versions.map((v, i) => ({ value: v, label: i === 0 ? `${v} (newest)` : v })), [spec]);

  const onSubmit = (input: CreateDatabaseInput) =>
    create.mutate(input, {
      onSuccess: onCreated,
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) {
          const msg = apiMessage(e);
          return setError(/variable/i.test(msg) ? "variableName" : "serviceName", { message: msg });
        }
        toast.error(apiMessage(e));
      },
    });

  return (
    <form id="add-database" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Segmented label="Engine" value={engine} onChange={pickEngine} options={ENGINES} />
      <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3">
        <Input label="Name" mono error={errors.serviceName?.message} {...register("serviceName")} />
        <Select label="Version" options={versionOptions} error={errors.version?.message} {...register("version")} />
      </div>
      {deployServers.length ? (
        <Select label="Server" options={deployServers.map((s) => ({ value: s.id, label: `${s.serverName} (${s.serverIp})` }))} error={errors.serverId?.message} {...register("serverId")} />
      ) : (
        <p className="m-0 text-[12px] text-crit">Add a deploy server first (Settings → Remote servers). Databases need one to run on.</p>
      )}
      {tight && (
        <p className="m-0 rounded-lg bg-warn-s px-3 py-2 text-[11.5px] text-warn">
          This server has about {formatBytes(freeBytes)} of memory free; {spec.label} needs around {spec.idleMemoryMb} MB. It may run slowly or fail to start.
        </p>
      )}
      <Input label="Connection string variable" mono error={errors.variableName?.message} {...register("variableName")} />
      <p className="-mt-2 m-0 text-[11px] text-sand">
        Warden saves the connection string as a secret variable with this name in {env.environmentName}. Services that use it must run on the same server: the database is only reachable on that server's private network, never from the internet.
      </p>
    </form>
  );
}
