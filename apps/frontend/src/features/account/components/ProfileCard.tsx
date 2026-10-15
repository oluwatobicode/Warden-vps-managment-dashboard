import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { ProfileNameSchema, type ProfileNameInput, type SessionUser } from "shared-types";
import { Card, FactRow } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useUpdateProfile } from "../hooks/useAccount";
import { AvatarPicker } from "./AvatarPicker";
import { UserAvatar } from "./UserAvatar";

export function ProfileCard({ user }: { user: SessionUser }) {
  const [picking, setPicking] = useState(false);
  const save = useUpdateProfile();
  const name = `${user.firstName} ${user.lastName}`;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileNameInput>({
    resolver: zodResolver(ProfileNameSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  const onSubmit = (input: ProfileNameInput) =>
    save.mutate(input, {
      onSuccess: (u) => {
        reset({ firstName: u.firstName, lastName: u.lastName });
        toast.success("Name updated");
      },
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <Card title="Profile" sub="How you appear to your team: in the navbar, team list and audit log.">
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <UserAvatar avatar={user.avatar} name={name} size={72} />
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setPicking(true)} className="px-3.5 py-2 text-xs">
            Change avatar
          </Button>
          <span className="text-[11px] text-sand">Avatars by <a href="https://www.dicebear.com" target="_blank" rel="noreferrer" className="text-link">DiceBear</a></span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3.5">
          <Input label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
          <Input label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Save name
          </Button>
        </div>
      </form>

      <div className="mt-2">
        <FactRow label="Email">{user.email}</FactRow>
      </div>
      <p className="m-0 mt-1 text-[11px] text-sand">Your email can't be changed here yet.</p>

      {picking && <AvatarPicker current={user.avatar} name={name} onClose={() => setPicking(false)} />}
    </Card>
  );
}
