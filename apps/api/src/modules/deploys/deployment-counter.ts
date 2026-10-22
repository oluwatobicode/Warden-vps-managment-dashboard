import type { Prisma } from 'db';

/**
 * Create a QUEUED Deployment with the next per-org number. The counter is
 * bumped INSIDE the caller's transaction, so two deploys at the same moment
 * can never share a #number (Postgres increments it atomically). Used by app
 * deploys, rollbacks, and database create/restart/restore alike.
 */
export async function createDeployment(
  tx: Prisma.TransactionClient,
  d: {
    orgId: string;
    serviceId: string;
    message: string | null;
    triggeredById: string | null;
    triggeredByName: string | null;
    type?: 'MANUAL' | 'AUTOMATED';
    branch?: string | null;
    commitSha?: string | null;
    rollbackOfId?: string | null;
  },
): Promise<{ id: string; number: number }> {
  const { deployCounter } = await tx.organization.update({
    where: { id: d.orgId },
    data: { deployCounter: { increment: 1 } },
    select: { deployCounter: true },
  });
  return tx.deployment.create({
    data: {
      number: deployCounter,
      organizationId: d.orgId,
      serviceId: d.serviceId,
      deploymentStatus: 'QUEUED',
      deploymentType: d.type ?? 'MANUAL',
      branch: d.branch ?? null,
      commitSha: d.commitSha ?? null,
      commitMessage: d.message,
      rollbackOfId: d.rollbackOfId ?? null,
      triggeredById: d.triggeredById,
      triggeredByName: d.triggeredByName,
      history: { create: { status: 'QUEUED', message: 'Queued' } },
    },
    select: { id: true, number: true },
  });
}
