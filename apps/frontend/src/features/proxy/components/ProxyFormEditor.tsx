import { useEffect, useRef } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProxyFormSchema, type ProxyForm } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Toggle } from "../../../components/ui/Toggle";

/**
 * The safe, structured part of warden.yml: force HTTPS, extra routes and
 * redirects. Validated with the same schema the api uses; every valid change
 * goes up to the tab, which checks the whole file and previews it.
 */
export function ProxyFormEditor({ value, onChange, disabled }: { value: ProxyForm; onChange: (f: ProxyForm, valid: boolean) => void; disabled: boolean }) {
  const { control, register, formState: { errors, isValid } } = useForm<ProxyForm>({ resolver: zodResolver(ProxyFormSchema), mode: "onChange", defaultValues: value });
  const routes = useFieldArray({ control, name: "routes" });
  const redirects = useFieldArray({ control, name: "redirects" });
  const draft = useWatch({ control }) as ProxyForm;
  const report = JSON.stringify(draft);

  // The latest onChange, without making it a reason to re-run (a new function
  // each render would otherwise loop: report → parent state → render → report…).
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);
  useEffect(() => {
    // `report` is the draft as a string, so this runs once per real change.
    changed.current(JSON.parse(report) as ProxyForm, isValid);
  }, [report, isValid]);

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5 disabled:opacity-70">
      <Controller
        control={control}
        name="forceHttps"
        render={({ field }) => (
          <Toggle
            checked={field.value}
            onChange={field.onChange}
            label="Force HTTPS for every domain"
            detail="Every http:// request for a real domain on this server is sent to https://. sslip.io addresses are left alone: they have no certificates."
          />
        )}
      />

      <section className="flex flex-col gap-2.5">
        <div>
          <h4 className="m-0 text-[12.5px] font-semibold text-strong">Extra routes</h4>
          <p className="mt-1 mb-0 text-[11.5px] text-sand">A domain → an app running directly on this server (not deployed by Warden), by its port.</p>
        </div>
        {routes.fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_110px_auto_auto] items-start gap-2.5">
            <Input label="Domain" mono placeholder="old.example.com" error={errors.routes?.[i]?.domain?.message} {...register(`routes.${i}.domain`)} />
            <Input label="Port on the server" mono inputMode="numeric" error={errors.routes?.[i]?.port?.message} {...register(`routes.${i}.port`, { valueAsNumber: true })} />
            <div className="mt-[26px]">
              <Controller control={control} name={`routes.${i}.https`} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="HTTPS" />} />
            </div>
            <Button variant="ghost" onClick={() => routes.remove(i)} className="mt-[26px] px-2 py-2 text-[11px]">
              Remove
            </Button>
          </div>
        ))}
        {errors.routes?.message && <span className="text-[11.5px] text-crit">{errors.routes.message}</span>}
        <Button variant="ghost" onClick={() => routes.append({ domain: "", port: 8080, https: true })} className="self-start px-0 text-[11.5px]">
          + Add a route
        </Button>
      </section>

      <section className="flex flex-col gap-2.5">
        <div>
          <h4 className="m-0 text-[12.5px] font-semibold text-strong">Redirects</h4>
          <p className="mt-1 mb-0 text-[11.5px] text-sand">A domain → another address, like www.example.com → https://example.com.</p>
        </div>
        {redirects.fields.map((f, i) => (
          <div key={f.id} className="flex flex-col gap-2.5 rounded-xl border border-cb px-3.5 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-start gap-2.5">
              <Input label="From" mono placeholder="www.example.com" error={errors.redirects?.[i]?.from?.message} {...register(`redirects.${i}.from`)} />
              <Input label="To" mono placeholder="https://example.com" error={errors.redirects?.[i]?.to?.message} {...register(`redirects.${i}.to`)} />
              <Button variant="ghost" onClick={() => redirects.remove(i)} className="mt-[26px] px-2 py-2 text-[11px]">
                Remove
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Controller control={control} name={`redirects.${i}.keepPath`} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Keep the path" detail="/blog/post → /blog/post" />} />
              <Controller control={control} name={`redirects.${i}.permanent`} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Permanent (301)" detail="Off: temporary (302)" />} />
              <Controller control={control} name={`redirects.${i}.https`} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Also over HTTPS" detail="Gets a certificate for the old domain" />} />
            </div>
          </div>
        ))}
        {errors.redirects?.message && <span className="text-[11.5px] text-crit">{errors.redirects.message}</span>}
        <Button
          variant="ghost"
          onClick={() => redirects.append({ from: "", to: "", keepPath: true, permanent: true, https: true })}
          className="self-start px-0 text-[11.5px]"
        >
          + Add a redirect
        </Button>
      </section>
    </fieldset>
  );
}
