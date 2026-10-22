import type { Ref } from "react";
import { Select } from "../../../components/ui/Select";
import { useServers } from "../hooks/useServers";
import { serverOption } from "../serverOption";

/**
 * Pick one of the org's DEPLOY servers (the only kind that runs services and
 * databases). `placeholder` adds an empty choice, e.g. "No default server".
 */
export function ServerSelect({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled,
  ref,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (serverId: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  const servers = useServers();
  const deploy = (servers.data ?? []).filter((s) => s.serverType === "DEPLOY");
  return (
    <Select
      ref={ref}
      label={label}
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      disabled={disabled || servers.isPending}
      placeholder={servers.isPending ? "Loading servers…" : deploy.length ? placeholder : "No deploy servers yet (Settings → Remote servers)"}
      options={deploy.map(serverOption)}
    />
  );
}
