import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import type { z } from "zod";
import { CreateServerSchema, type CreateServerInput } from "shared-types";
import { Drawer } from "../../../components/ui/Drawer";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Segmented } from "../../../components/ui/Segmented";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { optionalNumber, optionalText } from "../../../utils/forms";
import { useSshKeys } from "../../ssh-keys/hooks/useSshKeys";
import { useCreateServer } from "../hooks/useServers";

type In = z.input<typeof CreateServerSchema>;

/** Warden reaches servers over plain SSH: nothing to install on the host. */
export function AddServerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const keys = useSshKeys();
  const create = useCreateServer();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<In, unknown, CreateServerInput>({
    resolver: zodResolver(CreateServerSchema),
    defaultValues: { serverPort: 22, serverType: "DEPLOY", serverSshKeyId: "" },
  });
  const type = useWatch({ control, name: "serverType" });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = (input: CreateServerInput) =>
    create.mutate(input, {
      onSuccess: (server) => {
        toast.success(`${server.serverName} saved. Test the connection next`);
        close();
        navigate(`/settings/servers/${server.id}`);
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("serverIp", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });

  const noKeys = keys.data?.length === 0;

  return (
    <Drawer
      open={open}
      onClose={close}
      kicker="SETTINGS · REMOTE SERVERS"
      title="Add server"
      description="Warden connects over SSH with one of your keys. Nothing gets installed on the host."
      footer={
        <>
          <Button variant="ghost" onClick={close} className="px-0 text-xs">Cancel</Button>
          <Button type="submit" form="add-server" loading={create.isPending} disabled={noKeys}>Save server</Button>
        </>
      }
    >
      <form id="add-server" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input label="Server name" placeholder="hel-06" mono autoFocus error={errors.serverName?.message} {...register("serverName")} />
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <Input label="Host or IP" placeholder="65.21.14.208" mono error={errors.serverIp?.message} {...register("serverIp")} />
          <Input label="SSH port" inputMode="numeric" mono error={errors.serverPort?.message} {...register("serverPort", { setValueAs: optionalNumber })} />
        </div>
        <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3">
          <Input label="SSH user" placeholder="deploy" mono error={errors.serverSSHUsername?.message} {...register("serverSSHUsername")} />
          <Controller
            control={control}
            name="serverSshKeyId"
            render={({ field }) => (
              <Select
                label="SSH key"
                placeholder={keys.isPending ? "Loading…" : "Pick a key"}
                options={(keys.data ?? []).map((k) => ({ value: k.id, label: k.sshKeyName }))}
                error={errors.serverSshKeyId?.message}
                {...field}
              />
            )}
          />
        </div>
        {noKeys && (
          <p className="-mt-2 text-[11.5px] text-warn">
            You need an SSH key first. <Link to="/settings/ssh-keys" className="text-link">Add one</Link>, put its public half on the server, then come back.
          </p>
        )}
        <Segmented
          label="Server type"
          value={type ?? "DEPLOY"}
          onChange={(t) => setValue("serverType", t)}
          options={[
            { id: "DEPLOY", label: "Deploy server", detail: "Runs containers and serves traffic" },
            { id: "BUILD", label: "Build server", detail: "Builds images only, no traffic" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Provider (optional)" placeholder="Hetzner" error={errors.provider?.message} {...register("provider", { setValueAs: optionalText })} />
          <Input label="Location (optional)" placeholder="Falkenstein" error={errors.serverLocation?.message} {...register("serverLocation", { setValueAs: optionalText })} />
        </div>
      </form>
    </Drawer>
  );
}
