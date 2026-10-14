import type { ServiceStatus } from 'shared-types';

// Worst first. The card should alarm on the worst case, not average it away
// (PHASE-1 doc, "Status rollup rule"). NOT_DEPLOYED is last: one healthy
// service outranks any number of services that were never deployed.
const RANK: Record<ServiceStatus, number> = {
  FAILED: 4,
  DEGRADED: 3,
  DEPLOYING: 2,
  HEALTHY: 1,
  NOT_DEPLOYED: 0,
};

/** Worst-status-wins. No services → NOT_DEPLOYED (nothing is running). */
export function rollupStatus(statuses: ServiceStatus[]): ServiceStatus {
  return statuses.reduce<ServiceStatus>(
    (worst, s) => (RANK[s] > RANK[worst] ? s : worst),
    'NOT_DEPLOYED',
  );
}
