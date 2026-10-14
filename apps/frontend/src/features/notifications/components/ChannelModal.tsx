import { useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  CreateNotificationChannelSchema,
  UpdateNotificationChannelSchema,
  type NotificationChannel,
  type NotificationChannelType,
  type NotificationEvent,
} from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Segmented";
import { Textarea } from "../../../components/ui/Textarea";
import { Toggle } from "../../../components/ui/Toggle";
import { applyApiIssues, apiMessage, apiStatus } from "../../../utils/apiMessage";
import { optionalText } from "../../../utils/forms";
import { useCreateChannel, useUpdateChannel } from "../hooks/useNotificationChannels";
import { EventPicker } from "./EventPicker";

type Values = {
  type?: NotificationChannelType;
  name: string;
  enabled?: boolean;
  events: NotificationEvent[];
  webhookUrl?: string;
  emailRecipients?: string[];
};

/** "a@x.com, b@x.com\nc@x.com" → ["a@x.com", "b@x.com", "c@x.com"] */
const toList = (v: unknown) => (typeof v === "string" ? v.split(/[\s,;]+/).filter(Boolean) : v);

/** New channel, or edit one (type can't change: it's a different channel). */
export function ChannelModal({ editing, onClose }: { editing?: NotificationChannel; onClose: () => void }) {
  const create = useCreateChannel();
  const update = useUpdateChannel();
  const [type, setType] = useState<NotificationChannelType>(editing?.type ?? "DISCORD");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    // Create: union on `type`. Edit: strict partial (no `type` field registered).
    resolver: zodResolver(editing ? UpdateNotificationChannelSchema : CreateNotificationChannelSchema) as unknown as Resolver<Values>,
    defaultValues: editing
      ? { name: editing.name, enabled: editing.enabled, events: editing.events, emailRecipients: editing.type === "EMAIL" ? editing.emailRecipients : undefined }
      : { type: "DISCORD", name: "", events: ["deploy.failed", "deploy.gate_failed", "server.offline"] },
  });
  const isEmail = type === "EMAIL";

  const fail = (e: unknown) => {
    if (applyApiIssues(e, setError)) return;
    if (apiStatus(e) === 409) return setError("name", { message: apiMessage(e) });
    toast.error(apiMessage(e));
  };

  const onSubmit = (v: Values) => {
    if (editing) {
      const input = { name: v.name, enabled: v.enabled, events: v.events, ...(isEmail ? { emailRecipients: v.emailRecipients } : v.webhookUrl ? { webhookUrl: v.webhookUrl } : {}) };
      return update.mutate({ id: editing.id, input }, { onSuccess: () => (toast.success(`${v.name} updated`), onClose()), onError: fail });
    }
    const input = isEmail
      ? { type: "EMAIL" as const, name: v.name, events: v.events, emailRecipients: v.emailRecipients ?? [] }
      : { type, name: v.name, events: v.events, webhookUrl: v.webhookUrl ?? "" };
    create.mutate(input, { onSuccess: (c) => (toast.success(`${c.name} added. Send a test to check it`), onClose()), onError: fail });
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="w-[580px]"
      title={editing ? `Edit ${editing.name}` : "Add notification channel"}
      description="Where Warden posts when something happens. Real alerts start with deploys and server monitoring."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">Cancel</Button>
          <Button type="submit" form="channel" loading={create.isPending || update.isPending}>{editing ? "Save" : "Add channel"}</Button>
        </>
      }
    >
      <form id="channel" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {!editing && (
          <Segmented
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { id: "DISCORD", label: "Discord" },
              { id: "SLACK", label: "Slack" },
              { id: "EMAIL", label: "Email" },
            ]}
          />
        )}
        {!editing && <input type="hidden" value={type} {...register("type")} />}
        <Input label="Name" placeholder="team-alerts" autoFocus error={errors.name?.message} {...register("name")} />
        {isEmail ? (
          <Textarea
            label="Recipients (one per line or comma-separated, up to 20)"
            rows={3}
            placeholder={"oncall@company.dev\nops@company.dev"}
            error={errors.emailRecipients?.message ?? errors.emailRecipients?.root?.message ?? (Array.isArray(errors.emailRecipients) ? errors.emailRecipients.find(Boolean)?.message : undefined)}
            defaultValue={editing?.emailRecipients.join("\n")}
            {...register("emailRecipients", { setValueAs: toList })}
          />
        ) : (
          <Input
            label={editing ? "Webhook URL (empty = keep the current one)" : "Webhook URL"}
            mono
            autoComplete="off"
            placeholder={type === "SLACK" ? "https://hooks.slack.com/services/…" : "https://discord.com/api/webhooks/…"}
            error={errors.webhookUrl?.message}
            {...register("webhookUrl", { setValueAs: optionalText })}
          />
        )}
        <Controller
          control={control}
          name="events"
          render={({ field }) => <EventPicker value={field.value} onChange={field.onChange} error={errors.events?.message ?? errors.events?.root?.message} />}
        />
        {editing && (
          <Controller
            control={control}
            name="enabled"
            render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label="Enabled" detail="Off = keep the channel but send nothing to it." />}
          />
        )}
      </form>
    </Modal>
  );
}
