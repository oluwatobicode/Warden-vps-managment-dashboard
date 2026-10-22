import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import type { z } from "zod";
import { CreateServiceSchema, type CreateFromRepoResult, type CreateServiceInput, type Environment } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { optionalNumber, optionalText } from "../../../utils/forms";
import { useCreateService } from "../hooks/useServices";
import { DatabaseForm } from "../../databases/components/DatabaseForm";
import { ServerSelect } from "../../servers/components/ServerSelect";
import { RepoWizard } from "./repo-wizard/RepoWizard";

type Kind = "github" | "image" | "database";

const DESCRIPTION: Record<Kind, string> = {
  github: "Pick a repo: Warden reads it, finds the apps in it and fills in how to build and start each one.",
  image: "An image that's already built (Docker Hub, GHCR…). Warden pulls it and runs it.",
  database: "Warden runs the database on your server, keeps its data in a volume, and gives your services the connection string.",
};

/**
 * Add to an environment: an app from GitHub (the 3-step repo wizard), a
 * prebuilt Docker image, or a database. All of them start on the
 * environment's default server unless another is picked.
 */
export function AddServiceModal({
  open,
  onClose,
  env,
  servicePath,
  deployPath,
}: {
  open: boolean;
  onClose: () => void;
  env: Environment;
  servicePath: (id: string) => string;
  deployPath: (serviceId: string, deploymentId: string) => string;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("github");
  const [dbBusy, setDbBusy] = useState(false);
  // Remount the wizard and forms each time the window opens, so they start fresh.
  const [round, setRound] = useState(0);

  const close = () => {
    setKind("github");
    setRound((r) => r + 1);
    onClose();
  };

  const onRepoDone = (r: CreateFromRepoResult, deployed: boolean) => {
    for (const s of r.services) if (s.deployNote) toast.error(`${s.serviceName}: ${s.deployNote}`);
    close();
    if (r.services.length === 1) {
      const s = r.services[0];
      toast.success(s.deploymentId ? `${s.serviceName} created. Deploying` : `${s.serviceName} created`);
      navigate(s.deploymentId ? deployPath(s.id, s.deploymentId) : servicePath(s.id));
    } else {
      toast.success(`${r.services.length} services created${deployed ? ". Deploying" : ""}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      width={kind === "github" ? "w-[720px]" : "w-[560px]"}
      title={`Add to ${env.environmentName}`}
      description={DESCRIPTION[kind]}
      footer={
        kind === "github" ? undefined : (
          <>
            <Button variant="ghost" onClick={close} className="px-0 text-xs">
              Cancel
            </Button>
            {kind === "image" ? (
              <Button type="submit" form="add-service">
                Add service
              </Button>
            ) : (
              <Button type="submit" form="add-database" loading={dbBusy}>
                Create database
              </Button>
            )}
          </>
        )
      }
    >
      <Segmented
        label="What are you adding?"
        value={kind}
        onChange={setKind}
        options={[
          { id: "github", label: "From GitHub", detail: "Your code, built by Warden" },
          { id: "image", label: "Docker image", detail: "Already built" },
          { id: "database", label: "Database", detail: "Postgres, MySQL or Redis" },
        ]}
      />
      {kind === "github" && <RepoWizard key={round} env={env} onCancel={close} onDone={onRepoDone} />}
      {kind === "image" && (
        <ImageForm
          key={round}
          env={env}
          onCreated={(id, name) => {
            toast.success(`${name} added to ${env.environmentName}`);
            close();
            navigate(servicePath(id));
          }}
        />
      )}
      {kind === "database" && (
        <DatabaseForm
          key={round}
          env={env}
          onPending={setDbBusy}
          onCreated={(service) => {
            toast.success(`Creating ${service.serviceName} in ${env.environmentName}`);
            close();
            navigate(servicePath(service.id));
          }}
        />
      )}
    </Modal>
  );
}

/** A prebuilt image: name, image, port, server. */
function ImageForm({ env, onCreated }: { env: Environment; onCreated: (id: string, name: string) => void }) {
  const create = useCreateService();
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof CreateServiceSchema>, unknown, CreateServiceInput>({
    resolver: zodResolver(CreateServiceSchema),
    defaultValues: { environmentId: env.id, type: "APPLICATION", serverId: env.defaultServerId ?? undefined },
  });
  const type = useWatch({ control, name: "type" });

  const onSubmit = (input: CreateServiceInput) =>
    create.mutate(input, {
      onSuccess: (s) => onCreated(s.id, s.serviceName),
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("serviceName", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });

  return (
    <form id="add-service" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input label="Service name" placeholder="api" mono autoFocus error={errors.serviceName?.message} {...register("serviceName")} />
      <Segmented
        label="Type"
        value={type ?? "APPLICATION"}
        onChange={(t) => {
          setValue("type", t);
          if (t === "WORKER") setValue("port", undefined);
        }}
        options={[
          { id: "APPLICATION", label: "Application", detail: "Serves traffic on a port" },
          { id: "WORKER", label: "Worker", detail: "Background jobs, no port" },
        ]}
      />
      <Input label="Image" placeholder="ghcr.io/acme/api:1.4.0" mono error={errors.image?.message ?? errors.githubRepoUrl?.message} {...register("image", { setValueAs: optionalText })} />
      <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
        <Controller
          control={control}
          name="serverId"
          render={({ field }) => <ServerSelect label="Server" placeholder="Choose later" error={errors.serverId?.message} {...field} onChange={(v) => field.onChange(v || undefined)} />}
        />
        {type !== "WORKER" && <Input label="Port" inputMode="numeric" placeholder="3000" mono error={errors.port?.message} {...register("port", { setValueAs: optionalNumber })} />}
      </div>
    </form>
  );
}
