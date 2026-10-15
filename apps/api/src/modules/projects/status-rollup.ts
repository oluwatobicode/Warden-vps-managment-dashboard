import type { ServiceStatus } from 'shared-types';

const RANK: Record<ServiceStatus, number> = {
  FAILED: 4,
  DEGRADED: 3,
  DEPLOYING: 2,
  HEALTHY: 1,
  NOT_DEPLOYED: 0,
};

export function rollupStatus(statuses: ServiceStatus[]): ServiceStatus {
  return statuses.reduce<ServiceStatus>(
    (worst, s) => (RANK[s] > RANK[worst] ? s : worst),
    'NOT_DEPLOYED',
  );
}
