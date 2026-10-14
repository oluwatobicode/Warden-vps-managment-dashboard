import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { CreateApiTokenSchema, type CreateApiTokenInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { CopyButton } from "../../../components/ui/CopyButton";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useCreateApiToken } from "../hooks/useApiTokens";

/**
 * Two stages: the form, then the raw token, shown ONCE. The token only lives
 * in this component's state and is gone when the modal closes.
 */
export function CreateTokenModal({ onClose }: { onClose: () => void }) {
  const create = useCreateApiToken();
  const [token, setToken] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof CreateApiTokenSchema>, unknown, CreateApiTokenInput>({
    resolver: zodResolver(CreateApiTokenSchema),
    defaultValues: { apiName: "", apiTokenScope: "DEPLOY", expiresIn: "90d" },
  });

  const onSubmit = (input: CreateApiTokenInput) =>
    create.mutate(input, {
      onSuccess: (t) => setToken(t.token),
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-black/75 p-6" onMouseDown={(e) => e.target === e.currentTarget && !token && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="token-title" className="w-[520px] max-w-full rounded-[20px] border border-cb bg-surface px-7 py-[26px]">
        {!token ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div>
              <h3 id="token-title" className="m-0 text-lg font-bold tracking-[-0.3px] text-strong">Create API token</h3>
              <p className="mt-[9px] text-[12.5px] text-muted-warm">For CI and scripts. Shown once, then only its hash is kept.</p>
            </div>
            <Input label="Token name" placeholder="github-actions" mono autoFocus error={errors.apiName?.message} {...register("apiName")} />
            <Controller
              control={control}
              name="apiTokenScope"
              render={({ field }) => (
                <Segmented
                  label="Scope"
                  value={field.value ?? "DEPLOY"}
                  onChange={field.onChange}
                  options={[
                    { id: "READ", label: "Read only", detail: "Acts as a Viewer" },
                    { id: "DEPLOY", label: "Deploy", detail: "Acts as a Developer" },
                    { id: "ADMIN", label: "Admin", detail: "Full API access" },
                  ]}
                />
              )}
            />
            <Controller
              control={control}
              name="expiresIn"
              render={({ field }) => (
                <Segmented
                  label="Expires"
                  value={field.value ?? "90d"}
                  onChange={field.onChange}
                  options={[
                    { id: "30d", label: "30 days" },
                    { id: "90d", label: "90 days" },
                    { id: "1y", label: "1 year" },
                    { id: "never", label: "Never" },
                  ]}
                />
              )}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={onClose} className="px-0 text-xs">Cancel</Button>
              <Button type="submit" loading={create.isPending}>Generate token</Button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex items-center gap-2.5">
              <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2.6} className="text-good" />
              <h3 id="token-title" className="m-0 text-lg font-bold tracking-[-0.3px] text-strong">Token created</h3>
            </div>
            <p className="mt-[9px] text-[12.5px] text-muted-warm">Copy it now. You won't see it again.</p>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink px-4 py-[15px]">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#7dd3a0]">{token}</span>
              <CopyButton value={token} text="Copy" done="Token copied" />
            </div>
            <div className="mt-3 flex items-center gap-[9px] rounded-xl bg-warn-s px-[15px] py-3 text-[11.5px] text-warn">
              <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={1.5} className="shrink-0" />
              Store it in a secret manager (e.g. GitHub Actions secrets), never in your repo.
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
