import { prisma } from "db";
import type { SshTarget } from "ssh-client";
import { DekCache, EnvKeyProvider, decrypt } from "warden-crypto";
import { env } from "./env";

// Same unwrap code as the api's OrgKeyService; only the loader differs.
const deks = new DekCache(new EnvKeyProvider({ masterKeyHex: env.MASTER_KEY }), async (orgId) => {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { dataKeyWrapped: true } });
  if (!org) throw new Error(`organization ${orgId} not found`);
  return org.dataKeyWrapped;
});

export const getDek = (orgId: string) => deks.get(orgId);

/** Decrypt an org secret stored as "v1.iv.ct.tag". */
export async function unseal(orgId: string, stored: string): Promise<string> {
  return decrypt(stored, { v1: await deks.get(orgId) });
}

interface ServerForSsh {
  organizationId: string;
  serverIp: string;
  serverPort: number;
  serverSSHUsername: string;
  serverSshKey: { privateKeyEncrypted: string };
}

/** Where and how to SSH in. The decrypted key lives only in this object, in memory. */
export async function sshTargetFor(s: ServerForSsh): Promise<SshTarget> {
  return {
    host: s.serverIp,
    port: s.serverPort,
    username: s.serverSSHUsername,
    privateKey: await unseal(s.organizationId, s.serverSshKey.privateKeyEncrypted),
  };
}
