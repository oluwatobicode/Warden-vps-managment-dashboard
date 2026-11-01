import { prisma } from "db";
import { unseal } from "../keys";
import { Masker } from "./lines";

/**
 * A service's secret values, for masking its log: the secret variables of
 * its environment and its own, and the passwords of the environment's
 * databases (an app may print one on its own, not inside DATABASE_URL).
 * Read once per container: a changed variable only reaches the app on its
 * next deploy, which is a new container.
 */
export async function maskerFor(s: { id: string; organizationId: string; environmentId: string }): Promise<Masker> {
  const [envVars, svcVars, dbs] = await Promise.all([
    prisma.environmentVariable.findMany({ where: { environmentId: s.environmentId, organizationId: s.organizationId, isSecret: true }, select: { valueEncrypted: true } }),
    prisma.serviceVariable.findMany({ where: { serviceId: s.id, organizationId: s.organizationId, isSecret: true }, select: { valueEncrypted: true } }),
    prisma.serviceDatabase.findMany({
      where: { organizationId: s.organizationId, service: { environmentId: s.environmentId } },
      select: { passwordEncrypted: true, rootPasswordEncrypted: true },
    }),
  ]);
  const sealed = [
    ...envVars.map((v) => v.valueEncrypted),
    ...svcVars.map((v) => v.valueEncrypted),
    ...dbs.flatMap((d) => [d.passwordEncrypted, d.rootPasswordEncrypted].filter((x): x is string => !!x)),
  ];
  const values = await Promise.all(sealed.map((v) => unseal(s.organizationId, v).catch(() => "")));
  return new Masker(values);
}
