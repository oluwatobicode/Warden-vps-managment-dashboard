import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  UpdateEnvironmentSchema,
  type Environment,
  type UpdateEnvironmentInput,
} from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  applyApiIssues,
  apiMessage,
  apiStatus,
} from "../../../utils/apiMessage";
import { optionalText } from "../../../utils/forms";
import {
  useCreateEnvironment,
  useUpdateEnvironment,
} from "../hooks/useEnvironments";

export function EnvironmentModal({
  projectId,
  editing,
  onClose,
  onCreated,
}: {
  projectId: string;
  editing?: Environment;
  onClose: () => void;
  onCreated?: (env: Environment) => void;
}) {
  const create = useCreateEnvironment(projectId);
  const update = useUpdateEnvironment(projectId);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateEnvironmentInput>({
    resolver: zodResolver(UpdateEnvironmentSchema),
    defaultValues: {
      environmentName: editing?.environmentName ?? "",
      branch: editing?.branch ?? undefined,
    },
  });

  const fail = (e: unknown) => {
    if (applyApiIssues(e, setError)) return;
    if (apiStatus(e) === 409)
      return setError("environmentName", { message: apiMessage(e) });
    toast.error(apiMessage(e));
  };

  const onSubmit = (input: UpdateEnvironmentInput) => {
    if (editing) {
      update.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => (toast.success("Environment updated"), onClose()),
          onError: fail,
        },
      );
    } else {
      if (!input.environmentName)
        return setError("environmentName", {
          message: "Give the environment a name",
        });
      create.mutate(
        { environmentName: input.environmentName, branch: input.branch },
        {
          onSuccess: (env) => (
            toast.success(`${env.environmentName} created`),
            onCreated?.(env),
            onClose()
          ),
          onError: fail,
        },
      );
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${editing.environmentName}` : "New environment"}
      description="Lowercase letters, digits and dashes, e.g. staging or preview-2."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            form="environment"
            loading={create.isPending || update.isPending}
          >
            {editing ? "Save" : "Create environment"}
          </Button>
        </>
      }
    >
      <form
        id="environment"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          label="Name"
          placeholder="staging"
          mono
          autoFocus
          error={errors.environmentName?.message}
          {...register("environmentName", { setValueAs: optionalText })}
        />
        <Input
          label="Default branch (optional)"
          placeholder="main"
          mono
          error={errors.branch?.message}
          {...register("branch", { setValueAs: optionalText })}
        />
      </form>
    </Modal>
  );
}
