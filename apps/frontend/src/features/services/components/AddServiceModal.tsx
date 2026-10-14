import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import type { z } from "zod";
import {
  CreateServiceSchema,
  type CreateServiceInput,
  type Environment,
} from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import {
  applyApiIssues,
  apiMessage,
  apiStatus,
} from "../../../utils/apiMessage";
import { optionalNumber, optionalText } from "../../../utils/forms";
import { useCreateService } from "../hooks/useServices";

type Source = "repo" | "image";

export function AddServiceModal({
  open,
  onClose,
  env,
  servicePath,
}: {
  open: boolean;
  onClose: () => void;
  env: Environment;
  servicePath: (id: string) => string;
}) {
  const navigate = useNavigate();
  const create = useCreateService();
  const [source, setSource] = useState<Source>("repo");
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof CreateServiceSchema>, unknown, CreateServiceInput>(
    {
      resolver: zodResolver(CreateServiceSchema),
      defaultValues: { environmentId: env.id, type: "APPLICATION" },
    },
  );
  const type = useWatch({ control, name: "type" });

  const close = () => {
    reset({ environmentId: env.id, type: "APPLICATION" });
    setSource("repo");
    onClose();
  };

  const pickSource = (s: Source) => {
    setSource(s);

    if (s === "repo") setValue("image", undefined);
    else {
      setValue("githubRepoUrl", undefined);
      setValue("branch", undefined);
    }
  };

  const onSubmit = (input: CreateServiceInput) =>
    create.mutate(input, {
      onSuccess: (service) => {
        toast.success(`${service.serviceName} added to ${env.environmentName}`);
        close();
        navigate(servicePath(service.id));
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409)
          return setError("serviceName", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });

  return (
    <Modal
      open={open}
      onClose={close}
      width="w-[560px]"
      title={`Add a service to ${env.environmentName}`}
      description="One deployable thing from one repo or image. You pick its server afterwards."
      footer={
        <>
          <Button variant="ghost" onClick={close} className="px-0 text-xs">
            Cancel
          </Button>
          <Button type="submit" form="add-service" loading={create.isPending}>
            Add service
          </Button>
        </>
      }
    >
      <form
        id="add-service"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          label="Service name"
          placeholder="api"
          mono
          autoFocus
          error={errors.serviceName?.message}
          {...register("serviceName")}
        />
        <Segmented
          label="Type"
          value={type ?? "APPLICATION"}
          onChange={(t) => {
            setValue("type", t);
            if (t === "WORKER") setValue("port", undefined);
          }}
          options={[
            {
              id: "APPLICATION",
              label: "Application",
              detail: "Serves traffic on a port",
            },
            {
              id: "WORKER",
              label: "Worker",
              detail: "Background jobs, no port",
            },
          ]}
        />
        {errors.type && (
          <span className="-mt-2 text-[11.5px] text-crit">
            {errors.type.message}
          </span>
        )}
        <Segmented
          label="Source"
          value={source}
          onChange={pickSource}
          options={[
            {
              id: "repo",
              label: "GitHub repository",
              detail: "Built by Warden",
            },
            { id: "image", label: "Docker image", detail: "Already built" },
          ]}
        />
        {source === "repo" ? (
          <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
            <Input
              label="Repository URL"
              placeholder="https://github.com/acme/api"
              mono
              error={errors.githubRepoUrl?.message}
              {...register("githubRepoUrl", { setValueAs: optionalText })}
            />
            <Input
              label="Branch"
              placeholder={env.branch ?? "main"}
              mono
              error={errors.branch?.message}
              {...register("branch", { setValueAs: optionalText })}
            />
          </div>
        ) : (
          <Input
            label="Image"
            placeholder="ghcr.io/acme/api:1.4.0"
            mono
            error={errors.image?.message ?? errors.githubRepoUrl?.message}
            {...register("image", { setValueAs: optionalText })}
          />
        )}
        {source === "repo" && (
          <span className="-mt-2 text-[11px] text-sand">
            Leave the branch empty to use the environment's
            {env.branch ? ` (${env.branch})` : ""}.
          </span>
        )}
        {type !== "WORKER" && (
          <Input
            label="Port"
            inputMode="numeric"
            placeholder="3000"
            mono
            error={errors.port?.message}
            {...register("port", { setValueAs: optionalNumber })}
          />
        )}
      </form>
    </Modal>
  );
}
