import { Controller, useFieldArray, useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { CreateFromRepoSchema } from "shared-types";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Textarea } from "../../../../components/ui/Textarea";
import { ServerSelect } from "../../../servers/components/ServerSelect";
import { formField, formsToInput, type AppForm, type RepoSource } from "../../repoForm";
import type { CreateFromRepoInput } from "shared-types";

interface Form {
  apps: AppForm[];
}

/**
 * Step 3: everything Warden prefilled, per app, editable. The request is
 * checked with the api's own schema before it's sent; problems land under
 * the right field.
 */
export function ReviewStep({
  environmentId,
  source,
  initial,
  busy,
  onBack,
  onSubmit,
}: {
  environmentId: string;
  source: RepoSource;
  initial: AppForm[];
  busy: boolean;
  onBack: () => void;
  onSubmit: (input: CreateFromRepoInput) => void;
}) {
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<Form>({ defaultValues: { apps: initial } });
  const { fields } = useFieldArray({ control, name: "apps" });

  const submit = (deploy: boolean) =>
    handleSubmit(({ apps }) => {
      const input = formsToInput(environmentId, source, apps, deploy);
      const r = CreateFromRepoSchema.safeParse(input);
      if (!r.success) {
        for (const issue of r.error.issues) {
          const field = formField(issue.path);
          if (field) setError(field as `apps.${number}.serviceName`, { message: issue.message });
        }
        return;
      }
      onSubmit(r.data);
    });

  return (
    <form onSubmit={submit(true)} noValidate className="flex flex-col gap-3.5">
      {fields.map((f, i) => (
        <AppCard key={f.id} index={i} app={f} control={control} register={register} errors={errors} />
      ))}
      <div className="-mx-[22px] -mb-5 mt-1 flex items-center justify-between gap-3 border-t border-cb px-[18px] py-3.5">
        <Button variant="ghost" onClick={onBack} className="px-0 text-xs">
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={submit(false)} disabled={busy} className="text-xs">
            Just create
          </Button>
          <Button type="submit" loading={busy}>
            {fields.length > 1 ? `Create ${fields.length} and deploy` : "Create and deploy"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AppCard({ index: i, app, control, register, errors }: { index: number; app: AppForm; control: Control<Form>; register: UseFormRegister<Form>; errors: FieldErrors<Form> }) {
  const e = errors.apps?.[i];
  const vars = useFieldArray({ control, name: `apps.${i}.vars` });
  const web = app.type === "APPLICATION";
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-cb bg-field/30 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-faint">{app.key === "." ? "repo root" : app.key}</span>
        <span className="rounded-full bg-chip px-2 py-px text-[10.5px] text-muted-deep">{app.framework}</span>
        {app.website && <span className="rounded-full bg-brand-s px-2 py-px text-[10.5px] text-brand">website</span>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px] gap-3">
        <Input label="Service name" mono error={e?.serviceName?.message} {...register(`apps.${i}.serviceName`)} />
        <Controller control={control} name={`apps.${i}.serverId`} render={({ field }) => <ServerSelect label="Server" placeholder="Pick a server" error={e?.serverId?.message} {...field} />} />
        {web ? <Input label="Port" mono inputMode="numeric" error={e?.port?.message} {...register(`apps.${i}.port`)} /> : <Input label="Port" value="none (worker)" disabled />}
      </div>
      {app.buildMethod === "DOCKERFILE" ? (
        <Input label="Dockerfile" mono error={e?.dockerfilePath?.message} {...register(`apps.${i}.dockerfilePath`)} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Build command" mono placeholder="Railpack decides" error={e?.buildCommand?.message} {...register(`apps.${i}.buildCommand`)} />
          {app.website ? (
            <Input label="Built site folder" mono placeholder="dist" error={e?.staticOutputDir?.message} {...register(`apps.${i}.staticOutputDir`)} />
          ) : (
            <Input label="Start command" mono placeholder="Railpack decides" error={e?.startCommand?.message} {...register(`apps.${i}.startCommand`)} />
          )}
        </div>
      )}
      {app.website && <p className="-mt-1.5 m-0 text-[11px] text-sand">A website has no start command: the built folder is served as static files.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Root directory (empty = repo root)" mono error={e?.rootDirectory?.message} {...register(`apps.${i}.rootDirectory`)} />
        {web && <Input label="Health check path" mono error={e?.healthCheckPath?.message} {...register(`apps.${i}.healthCheckPath`)} />}
      </div>
      {app.watchPathsText && (
        <Textarea label="Deploy on pushes that change (one per line)" rows={2} className="font-mono text-[12px]" error={e?.watchPathsText?.message} {...register(`apps.${i}.watchPathsText`)} />
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs text-label">Variables {app.website ? "(baked in when it's built, so set them now)" : "(you can add more later)"}</span>
        {vars.fields.map((v, j) => (
          <div key={v.id} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_auto] items-start gap-2">
            <Input label="Key" mono placeholder="KEY" error={e?.vars?.[j]?.key?.message} {...register(`apps.${i}.vars.${j}.key`)} />
            <Input label="Value" mono type="password" autoComplete="off" placeholder="leave empty to skip" {...register(`apps.${i}.vars.${j}.value`)} />
            <Button variant="ghost" onClick={() => vars.remove(j)} className="mt-[26px] px-2 py-2 text-[11px]">
              Remove
            </Button>
          </div>
        ))}
        {e?.vars?.message && <span className="text-[11.5px] text-crit">{e.vars.message}</span>}
        <Button variant="ghost" onClick={() => vars.append({ key: "", value: "" })} className="self-start px-0 text-[11.5px]">
          + Add a variable
        </Button>
      </div>
      {app.notes.length > 1 && (
        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4 text-[11px] text-sand">
          {app.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
