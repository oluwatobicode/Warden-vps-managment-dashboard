import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { CreateProjectSchema, type CreateProjectInput } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  applyApiIssues,
  apiMessage,
  apiStatus,
} from "../../../utils/apiMessage";
import { useCreateProject } from "../hooks/useProjects";
import { EnvironmentToggles } from "./EnvironmentToggles";

export function CreateProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const create = useCreateProject();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      projectName: "",
      projectDescription: "",
      environments: ["production"],
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = ({ projectDescription, ...rest }: CreateProjectInput) =>
    create.mutate(
      { ...rest, projectDescription: projectDescription?.trim() || undefined },
      {
        onSuccess: (project) => {
          toast.success(
            `${project.projectName} created. Add your first service`,
          );
          close();
          navigate(`/projects/${project.id}`);
        },
        onError: (e) => {
          if (applyApiIssues(e, setError)) return;

          if (apiStatus(e) === 409)
            return setError("projectName", { message: apiMessage(e) });
          toast.error(apiMessage(e));
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create project"
      description="A project groups environments. Services live inside an environment."
      footer={
        <>
          <Button variant="ghost" onClick={close} className="px-0 text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-project"
            loading={create.isPending}
          >
            Create project
          </Button>
        </>
      }
    >
      <form
        id="create-project"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          label="Project name"
          placeholder="Beacon"
          autoFocus
          error={errors.projectName?.message}
          {...register("projectName")}
        />
        <Input
          label="Description"
          placeholder="What this project runs (optional)"
          error={errors.projectDescription?.message}
          {...register("projectDescription")}
        />
        <Controller
          control={control}
          name="environments"
          render={({ field }) => (
            <EnvironmentToggles
              value={field.value}
              onChange={field.onChange}
              error={
                errors.environments?.message ??
                errors.environments?.root?.message
              }
            />
          )}
        />
      </form>
    </Modal>
  );
}
