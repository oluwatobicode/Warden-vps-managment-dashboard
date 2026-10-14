import { rollupStatus } from './status-rollup';

describe('rollupStatus', () => {
  it('is NOT_DEPLOYED with no services', () => {
    expect(rollupStatus([])).toBe('NOT_DEPLOYED');
  });

  it('is HEALTHY when everything is healthy', () => {
    expect(rollupStatus(['HEALTHY', 'HEALTHY'])).toBe('HEALTHY');
  });

  it('lets one failure win over any number of healthy services', () => {
    expect(rollupStatus(['HEALTHY', 'HEALTHY', 'FAILED', 'HEALTHY'])).toBe('FAILED');
  });

  it('ranks FAILED > DEGRADED > DEPLOYING > HEALTHY > NOT_DEPLOYED', () => {
    expect(rollupStatus(['DEGRADED', 'FAILED'])).toBe('FAILED');
    expect(rollupStatus(['DEPLOYING', 'DEGRADED'])).toBe('DEGRADED');
    expect(rollupStatus(['HEALTHY', 'DEPLOYING'])).toBe('DEPLOYING');
    expect(rollupStatus(['NOT_DEPLOYED', 'HEALTHY'])).toBe('HEALTHY');
  });

  it('shows DEPLOYING only when nothing worse is happening', () => {
    expect(rollupStatus(['DEPLOYING', 'HEALTHY'])).toBe('DEPLOYING');
    expect(rollupStatus(['DEPLOYING', 'DEGRADED', 'HEALTHY'])).toBe('DEGRADED');
  });

  it('does not depend on order', () => {
    const s = ['HEALTHY', 'DEGRADED', 'NOT_DEPLOYED', 'DEPLOYING'] as const;
    expect(rollupStatus([...s])).toBe(rollupStatus([...s].reverse()));
  });
});
