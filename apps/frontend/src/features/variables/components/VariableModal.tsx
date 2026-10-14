import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { CreateServiceVariableSchema, type Variable } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Toggle } from "../../../components/ui/Toggle";
import {
  applyApiIssues,
  apiMessage,
  apiStatus,
} from "../../../utils/apiMessage";
import {
  useCreateVariable,
  useUpdateVariable,
  type VariableOwner,
} from "../hooks/useVariables";

const AddSchema = CreateServiceVariableSchema.pick({ key: true, value: true });
type AddValues = { key: string; value: string };

export function VariableModal({
  owner,
  editing,
  onClose,
}: {
  owner: VariableOwner;
  editing?: Variable;
  onClose: () => void;
}) {
  const create = useCreateVariable(owner);
  const update = useUpdateVariable(owner);
  const [isSecret, setIsSecret] = useState(editing?.isSecret ?? true);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AddValues>({
    resolver: editing ? undefined : zodResolver(AddSchema),

    defaultValues: {
      key: editing?.key ?? "",
      value: editing && !editing.isSecret ? (editing.value ?? "") : "",
    },
  });

  const fail = (e: unknown) => {
    if (applyApiIssues(e, setError)) return;
    if (apiStatus(e) === 409)
      return setError("key", { message: apiMessage(e) });
    toast.error(apiMessage(e));
  };

  const onSubmit = ({ key, value }: AddValues) => {
    if (!editing) {
      return create.mutate(
        { key, value, isSecret },
        {
          onSuccess: () => (toast.success(`${key} added`), onClose()),
          onError: fail,
        },
      );
    }

    const input: { value?: string; isSecret?: boolean } = {};
    if (editing.isSecret ? value !== "" : value !== (editing.value ?? ""))
      input.value = value;
    if (isSecret !== editing.isSecret) input.isSecret = isSecret;
    if (!Object.keys(input).length) return onClose();
    update.mutate(
      { id: editing.id, input },
      {
        onSuccess: () => (toast.success(`${editing.key} updated`), onClose()),
        onError: fail,
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${editing.key}` : "Add variable"}
      description="Changes apply the next time each service is deployed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            form="variable"
            loading={create.isPending || update.isPending}
          >
            {editing ? "Save" : "Add variable"}
          </Button>
        </>
      }
    >
      <form
        id="variable"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {!editing && (
          <Input
            label="Key"
            placeholder="DATABASE_URL"
            mono
            autoFocus
            autoComplete="off"
            error={errors.key?.message}
            {...register("key")}
          />
        )}
        <Input
          label="Value"
          mono
          autoComplete="off"
          autoFocus={!!editing}
          type={isSecret ? "password" : "text"}
          placeholder={
            editing?.isSecret
              ? "Leave empty to keep the current value"
              : "value"
          }
          error={errors.value?.message}
          {...register("value")}
        />
        <Toggle
          checked={isSecret}
          onChange={setIsSecret}
          label="Secret"
          detail="Hidden in lists; only shown when someone with access clicks Reveal. Stored encrypted either way."
        />
      </form>
    </Modal>
  );
}
