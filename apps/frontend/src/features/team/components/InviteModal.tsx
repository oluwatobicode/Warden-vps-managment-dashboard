import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { InviteMemberSchema, type InviteMemberInput } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { ROLE_LABEL } from "../../../utils/roles";
import { useInviteMember } from "../hooks/useTeam";
import { ROLE_DETAIL, ROLE_ORDER } from "./roleInfo";

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteMember();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({ resolver: zodResolver(InviteMemberSchema), defaultValues: { email: "", role: "VIEWER" } });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = (input: InviteMemberInput) =>
    invite.mutate(input, {
      onSuccess: () => {
        toast.success(`Invite sent to ${input.email}. It expires in 7 days`);
        close();
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("email", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite member"
      description="They get an email link that expires in 7 days."
      footer={
        <>
          <Button variant="ghost" onClick={close} className="px-0 text-xs">Cancel</Button>
          <Button type="submit" form="invite" loading={invite.isPending}>Send invite</Button>
        </>
      }
    >
      <form id="invite" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="dami@company.dev" autoFocus error={errors.email?.message} {...register("email")} />
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-[7px]">
              <legend className="mb-[9px] text-xs text-label">Role</legend>
              {ROLE_ORDER.map((r) => {
                const on = field.value === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => field.onChange(r)}
                    className={`flex cursor-pointer items-center gap-[11px] rounded-xl border px-3.5 py-3 text-left ${on ? "border-focus bg-field" : "border-cb bg-card"}`}
                  >
                    <span className={`grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] ${on ? "border-strong" : "border-focus"}`}>
                      {on && <span className="size-1.5 rounded-full bg-strong" />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[12.5px] font-semibold text-strong">{ROLE_LABEL[r]}</span>
                      <span className="text-[10.5px] text-sand">{ROLE_DETAIL[r]}</span>
                    </span>
                  </button>
                );
              })}
            </fieldset>
          )}
        />
      </form>
    </Modal>
  );
}
