import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { CreateSshKeySchema, type SshKey } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import { Textarea } from "../../../components/ui/Textarea";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { useCreateSshKey } from "../hooks/useSshKeys";

type Values = { mode: "generate" | "import"; sshKeyName: string; privateKey?: string };

/**
 * Generate a fresh ed25519 pair here, or import an existing private key.
 * Either way the private half is encrypted and never shown again.
 */
export function AddSshKeyModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (key: SshKey) => void }) {
  const create = useCreateSshKey();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    // The schema is a union on `mode`; Values covers both shapes.
    resolver: zodResolver(CreateSshKeySchema) as unknown as Resolver<Values>,
    defaultValues: { mode: "generate", sshKeyName: "" },
  });
  const mode = useWatch({ control, name: "mode" });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = (v: Values) =>
    create.mutate(v.mode === "import" ? { mode: "import", sshKeyName: v.sshKeyName, privateKey: v.privateKey ?? "" } : { mode: "generate", sshKeyName: v.sshKeyName }, {
      onSuccess: (key) => {
        toast.success(v.mode === "generate" ? "Key generated. Put its public half on your server" : "Key imported");
        onCreated(key);
        close();
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("sshKeyName", { message: apiMessage(e) });
        if (apiStatus(e) === 400) return setError("privateKey", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add SSH key"
      description="The private half is stored encrypted. Only the public half is ever shown."
      footer={
        <>
          <Button variant="ghost" onClick={close} className="px-0 text-xs">Cancel</Button>
          <Button type="submit" form="ssh-key" loading={create.isPending}>{mode === "import" ? "Import key" : "Generate key"}</Button>
        </>
      }
    >
      <form id="ssh-key" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input label="Key name" placeholder="hetzner-deploy" mono autoFocus error={errors.sshKeyName?.message} {...register("sshKeyName")} />
        <Segmented
          label="How do you want the key?"
          value={mode}
          onChange={(m) => setValue("mode", m)}
          options={[
            { id: "generate", label: "Generate ed25519", detail: "New pair, made here" },
            { id: "import", label: "Paste private key", detail: "One you already use" },
          ]}
        />
        {mode === "import" && (
          <Textarea
            label="Private key"
            rows={6}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            error={errors.privateKey?.message}
            {...register("privateKey")}
          />
        )}
      </form>
    </Modal>
  );
}
