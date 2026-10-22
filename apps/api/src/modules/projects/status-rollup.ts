import type { ServiceStatus } from 'shared-types';

// Stopped on purpose isn't a problem: it shows only when nothing else is running.
const RANK: Record<ServiceStatus, number> = {
  FAILED: 5,
  DEGRADED: 4,
  DEPLOYING: 3,
  HEALTHY: 2,
  STOPPED: 1,
  NOT_DEPLOYED: 0,
};

export function rollupStatus(statuses: ServiceStatus[]): ServiceStatus {
  return statuses.reduce<ServiceStatus>(
    (worst, s) => (RANK[s] > RANK[worst] ? s : worst),
    'NOT_DEPLOYED',
  );
}
