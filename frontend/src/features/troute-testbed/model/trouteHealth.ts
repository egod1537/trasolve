import { checkTrouteHealth } from '@/features/troute-testbed/api/troute';
import { type HealthState } from '@/features/troute-testbed/components/AppHeader';

export async function getHealthState(
  signal?: AbortSignal,
): Promise<HealthState> {
  try {
    const timeout = AbortSignal.timeout(5_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return (await checkTrouteHealth(requestSignal)) ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}
