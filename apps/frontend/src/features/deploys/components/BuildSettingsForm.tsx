import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { z } from "zod";
import { UpdateDeploySettingsSchema, type DeploySettings, type Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Toggle } from "../../../components/ui/Toggle";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useUpdateDeploySettings } from "../hooks/useDeploys";

// The api's own field rules, plus watch paths typed as one per line.
const s = UpdateDeploySettingsSchema.shape;
const FormSchema = z.object({
  rootDirectory: s.rootDirectory.unwrap(),
  dockerfilePath: s.dockerfilePath.unwrap(),
  buildCommand: z.string().max(500),
  startCommand: z.string().max(500),
  releaseCommand: z.string().max(500),
  staticOutputDir: s.staticOutputDir.unwrap().unwrap(),
  healthCheckPath: s.healthCheckPath.unwrap(),
  watchPathsText: z.string().superRefine((text, ctx) => {
    const r = s.watchPaths.unwrap().safeParse(lines(text));
    if (!r.success) ctx.addIssue({ code: "custom", message: r.error.issues[0]?.message ?? "Check the paths" });
  }),
  autoDeploy: z.boolean(),
});
type Form = z.infer<typeof FormSchema>;

const lines = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * How the service is built and started. Everything here works for monorepos:
 * build from the repo root, point at apps/<x>/Dockerfile or set Railpack's
 * build/start commands, and limit auto-deploys to the folders that matter.
 */
export function BuildSettingsForm({ service, settings, canEdit }: { service: Service; settings: DeploySettings; canEdit: boolean }) {
  const update = useUpdateDeploySettings(service.id);
  const web = service.type === "APPLICATION";
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    values: {
      rootDirectory: settings.rootDirectory,
      dockerfilePath: settings.dockerfilePath,
      buildCommand: settings.buildCommand ?? "",
      startCommand: settings.startCommand ?? "",
      releaseCommand: settings.releaseCommand ?? "",
      staticOutputDir: settings.staticOutputDir ?? "",
      healthCheckPath: settings.healthCheckPath,
      watchPathsText: settings.watchPaths.join("\n"),
      autoDeploy: settings.autoDeploy,
    },
  });

  const onSubmit = ({ watchPathsText, ...f }: Form) =>
    update.mutate(
      {
        ...f,
        buildCommand: f.buildCommand || null,
        startCommand: f.startCommand || null,
        releaseCommand: f.releaseCommand || null,
        staticOutputDir: f.staticOutputDir || null,
        watchPaths: lines(watchPathsText),
      },
      {
        onSuccess: (info) => {
          toast.success("Build settings saved. They're used from the next deploy");
          reset({ ...f, watchPathsText: info.settings.watchPaths.join("\n") });
        },
        onError: (e) => {
          if (!applyApiIssues(e, setError)) toast.error(apiMessage(e));
        },
      },
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4">
      <fieldset disabled={!canEdit} className="flex flex-col gap-3.5 disabled:opacity-70">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Root directory (empty = repo root)" mono placeholder="apps/api" error={errors.rootDirectory?.message} {...register("rootDirectory")} />
          <Input label="Dockerfile path (from the root directory)" mono error={errors.dockerfilePath?.message} {...register("dockerfilePath")} />
        </div>
        <p className="-mt-1.5 m-0 text-[11px] text-sand">If that Dockerfile exists, it's used. If not, Railpack works out how to build the app; the two commands below override what it picks.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Build command (Railpack)" mono placeholder="pnpm turbo build --filter=api" error={errors.buildCommand?.message} {...register("buildCommand")} />
          <Input label="Start command (Railpack)" mono placeholder="node apps/api/dist/main.js" error={errors.startCommand?.message} {...register("startCommand")} />
        </div>
        <Input
          label="Built site folder (websites only)"
          mono
          placeholder="dist, or . for files at the repo root"
          error={errors.staticOutputDir?.message}
          {...register("staticOutputDir")}
        />
        <p className="-mt-1.5 m-0 text-[11px] text-sand">For a website: Railpack serves this folder as static files, so leave the start command empty (a start command switches that off).</p>
        <Input label="Release command (runs once before it goes live)" mono placeholder="npx prisma migrate deploy" error={errors.releaseCommand?.message} {...register("releaseCommand")} />
        {web && <Input label="Health check path" mono error={errors.healthCheckPath?.message} {...register("healthCheckPath")} />}
        <Textarea label="Watch paths, one per line (empty = any change deploys)" rows={3} placeholder={"apps/api/**\npackages/**"} className="font-mono text-[12.5px]" error={errors.watchPathsText?.message} {...register("watchPathsText")} />
        <Controller
          control={control}
          name="autoDeploy"
          render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Deploy on every push" detail="Needs the repo connected through the Warden GitHub App (Settings → GitHub). Deploying from CI with an API token instead? Turn this off, or each push deploys twice." />}
        />
        {canEdit && (
          <Button type="submit" disabled={!isDirty} loading={update.isPending} className="self-start">
            Save build settings
          </Button>
        )}
      </fieldset>
    </form>
  );
}
