import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { UpdateServerSchema, type Server, type UpdateServerInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { clearableText, optionalNumber } from "../../../utils/forms";
import { useSshKeys } from "../../ssh-keys/hooks/useSshKeys";
import { useUpdateServer } from "../hooks/useServers";

/** Changing the address, user or key resets the status: test again afterwards. */
export function EditServerForm({ server: s, canEdit }: { server: Server; canEdit: boolean }) {
  const keys = useSshKeys();
  const update = useUpdateServer(s.id);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<UpdateServerInput>({
    resolver: zodResolver(UpdateServerSchema),
    values: {
      serverName: s.serverName,
      serverIp: s.serverIp,
      serverPort: s.serverPort,
      serverSSHUsername: s.serverSSHUsername,
      serverSshKeyId: s.sshKey.id,
      provider: s.provider,
      serverLocation: s.serverLocation,
    },
  });

  const onSubmit = (all: UpdateServerInput) => {
    const input = Object.fromEntries(Object.keys(dirtyFields).map((k) => [k, all[k as keyof UpdateServerInput]]));
    update.mutate(input, {
      onSuccess: () => {
        toast.success("Server updated");
        reset(undefined, { keepValues: true });
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("serverIp", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 flex flex-col gap-3.5">
      <fieldset disabled={!canEdit} className="flex flex-col gap-3.5 disabled:opacity-70">
        <Input label="Server name" mono error={errors.serverName?.message} {...register("serverName")} />
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <Input label="Host or IP" mono error={errors.serverIp?.message} {...register("serverIp")} />
          <Input label="SSH port" inputMode="numeric" mono error={errors.serverPort?.message} {...register("serverPort", { setValueAs: optionalNumber })} />
        </div>
        <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3">
          <Input label="SSH user" mono error={errors.serverSSHUsername?.message} {...register("serverSSHUsername")} />
          <Controller
            control={control}
            name="serverSshKeyId"
            render={({ field }) => (
              <Select label="SSH key" options={(keys.data ?? [{ id: s.sshKey.id, sshKeyName: s.sshKey.sshKeyName }]).map((k) => ({ value: k.id, label: k.sshKeyName }))} {...field} />
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Provider" error={errors.provider?.message} {...register("provider", { setValueAs: clearableText })} />
          <Input label="Location" error={errors.serverLocation?.message} {...register("serverLocation", { setValueAs: clearableText })} />
        </div>
      </fieldset>
      {canEdit && <Button type="submit" disabled={!isDirty} loading={update.isPending} className="self-start">Save changes</Button>}
    </form>
  );
}
