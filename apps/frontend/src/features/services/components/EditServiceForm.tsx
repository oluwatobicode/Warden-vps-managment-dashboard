import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { UpdateServiceSchema, type Service, type UpdateServiceInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { clearableNumber, clearableText } from "../../../utils/forms";
import { useUpdateService } from "../hooks/useServices";

/** Name, source and port. Only changed fields are sent; emptying one clears it. */
export function EditServiceForm({ service, canEdit }: { service: Service; canEdit: boolean }) {
  const update = useUpdateService(service.id);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<UpdateServiceInput>({
    resolver: zodResolver(UpdateServiceSchema),
    values: {
      serviceName: service.serviceName,
      githubRepoUrl: service.githubRepoUrl,
      branch: service.branch,
      image: service.image,
      port: service.port,
    },
  });

  const onSubmit = (all: UpdateServiceInput) => {
    const input = Object.fromEntries(Object.keys(dirtyFields).map((k) => [k, all[k as keyof UpdateServiceInput]]));
    update.mutate(input, {
      onSuccess: () => {
        toast.success("Service updated");
        reset(undefined, { keepValues: true }); // the saved values are the new "clean" state
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("serviceName", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3.5 flex flex-col gap-3.5">
      <fieldset disabled={!canEdit} className="flex flex-col gap-3.5 disabled:opacity-70">
        <Input label="Service name" mono error={errors.serviceName?.message} {...register("serviceName")} />
        <Input label="GitHub repository" mono placeholder="https://github.com/acme/api" error={errors.githubRepoUrl?.message} {...register("githubRepoUrl", { setValueAs: clearableText })} />
        <Input label="Branch (empty = the environment's)" mono error={errors.branch?.message} {...register("branch", { setValueAs: clearableText })} />
        <Input label="Image" mono placeholder="ghcr.io/acme/api:1.4.0" error={errors.image?.message} {...register("image", { setValueAs: clearableText })} />
        {service.type === "APPLICATION" && (
          <Input label="Port" inputMode="numeric" mono error={errors.port?.message} {...register("port", { setValueAs: clearableNumber })} />
        )}
      </fieldset>
      {canEdit && (
        <Button type="submit" disabled={!isDirty} loading={update.isPending} className="self-start">
          Save changes
        </Button>
      )}
    </form>
  );
}
