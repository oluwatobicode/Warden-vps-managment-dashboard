import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ImageAdd01Icon } from "@hugeicons/core-free-icons";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_IMAGE_TYPES,
  SUPPORT_LIMITS,
  SupportRequestSchema,
  type SupportRequestInput,
} from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useSendSupport } from "../hooks/useSupport";

const MB = SUPPORT_LIMITS.imageBytes / 1024 / 1024;
const ACCEPTED: readonly string[] = SUPPORT_IMAGE_TYPES;

type Shot = { file: File; url: string };

/** Dashboard → Support: a category, a subject, the message and up to 3 screenshots. */
export function SupportModal({ onClose }: { onClose: () => void }) {
  const send = useSendSupport();
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotError, setShotError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SupportRequestInput>({
    resolver: zodResolver(SupportRequestSchema),
    defaultValues: { category: "BUG", subject: "", message: "" },
  });
  const messageLength = useWatch({ control, name: "message" })?.length ?? 0;

  // Thumbnails are object URLs: remove() frees one, closing the modal frees the rest.
  const [urls] = useState(() => new Set<string>());
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const addFiles = (files: File[]) => {
    setShotError(null);
    const next = [...shots];
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) {
        setShotError(`${file.name || "That file"} isn't a PNG, JPG, WebP or GIF image`);
        continue;
      }
      if (file.size > SUPPORT_LIMITS.imageBytes) {
        setShotError(`${file.name || "That image"} is over ${MB} MB`);
        continue;
      }
      if (next.length >= SUPPORT_LIMITS.images) {
        setShotError(`Attach at most ${SUPPORT_LIMITS.images} screenshots`);
        break;
      }
      const url = URL.createObjectURL(file);
      urls.add(url);
      next.push({ file, url });
    }
    setShots(next);
  };
  const remove = (i: number) => {
    URL.revokeObjectURL(shots[i].url);
    urls.delete(shots[i].url);
    setShots(shots.filter((_, j) => j !== i));
    setShotError(null);
  };

  const onPaste = (e: ClipboardEvent) => {
    const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (images.length) {
      e.preventDefault();
      addFiles(images);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles([...e.dataTransfer.files]);
  };

  const onSubmit = (input: SupportRequestInput) =>
    send.mutate(
      { input: { ...input, page: window.location.pathname }, images: shots.map((s) => s.file) },
      {
        onSuccess: () => {
          toast.success("Sent. We'll reply by email, and a copy is on its way to you");
          onClose();
        },
        onError: (e) => {
          if (!applyApiIssues(e, setError)) toast.error(apiMessage(e));
        },
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      width="w-[600px]"
      title="Contact support"
      description="Report a bug, ask for a feature or ask a question. We reply by email."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">
            Cancel
          </Button>
          <Button type="submit" form="support" loading={send.isPending}>
            Send message
          </Button>
        </>
      }
    >
      <form id="support" onSubmit={handleSubmit(onSubmit)} onPaste={onPaste} noValidate className="flex flex-col gap-4">
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <div className="flex flex-col gap-[9px]">
              <span id="support-category" className="text-xs text-label">
                What is it about?
              </span>
              <div role="radiogroup" aria-labelledby="support-category" className="flex flex-wrap gap-2">
                {SUPPORT_CATEGORIES.map((c) => {
                  const on = field.value === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => field.onChange(c)}
                      className={`cursor-pointer rounded-full border px-3.5 py-[7px] text-xs transition-colors ${on ? "border-focus bg-raised text-strong" : "border-cb text-muted-warm hover:text-strong"}`}
                    >
                      {SUPPORT_CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        />

        <Input label="Subject" placeholder="Deploy stuck on Building" autoFocus maxLength={SUPPORT_LIMITS.subject} error={errors.subject?.message} {...register("subject")} />

        <div className="flex flex-col gap-1.5">
          <Textarea
            label="Message"
            rows={6}
            spellCheck
            placeholder="What happened, what you expected, and the steps to see it again"
            className="font-sans text-[13px]"
            maxLength={SUPPORT_LIMITS.message}
            error={errors.message?.message}
            {...register("message")}
          />
          <span className="self-end font-mono text-[10.5px] text-faint tabular-nums">
            {messageLength.toLocaleString()} / {SUPPORT_LIMITS.message.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-label">Screenshots (optional)</span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed p-2.5 transition-colors ${dragging ? "border-focus bg-raised" : "border-fieldb"}`}
          >
            {shots.map((s, i) => (
              <div key={s.url} className="group relative size-[72px] overflow-hidden rounded-lg border border-cb bg-field">
                <img src={s.url} alt={`Screenshot ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove screenshot ${i + 1}`}
                  className="absolute top-1 right-1 grid size-5 cursor-pointer place-items-center rounded-full bg-black/80 text-strong hover:bg-black"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2} />
                </button>
              </div>
            ))}
            {shots.length < SUPPORT_LIMITS.images && (
              <button
                type="button"
                onClick={() => picker.current?.click()}
                className="flex h-[72px] min-w-0 flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-lg px-3 text-xs text-muted-warm hover:text-strong"
              >
                <HugeiconsIcon icon={ImageAdd01Icon} size={18} strokeWidth={1.5} />
                <span className="text-left">
                  Add, drop or paste an image
                  <span className="block text-[10.5px] text-sand">
                    Up to {SUPPORT_LIMITS.images}, {MB} MB each · PNG, JPG, WebP, GIF
                  </span>
                </span>
              </button>
            )}
          </div>
          <input
            ref={picker}
            type="file"
            accept={SUPPORT_IMAGE_TYPES.join(",")}
            multiple
            hidden
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          {shotError && (
            <span role="alert" className="text-[11.5px] text-crit">
              {shotError}
            </span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-sand">
          Your name, email, organization, role, this page and your browser are sent with the message, so we can look into it faster.
        </p>
      </form>
    </Modal>
  );
}
