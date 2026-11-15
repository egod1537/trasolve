import { tripIdSchema } from '@trasolve/shared';
import { L } from '@/shared/i18n';

export function readPendingId(value: string): string {
  const parsed = tripIdSchema.safeParse(value);
  if (!parsed.success || !parsed.data.startsWith('pending-')) {
    throw new Error(L('map:tripCommands.error.newTripItemIdIncorrect'));
  }
  return parsed.data;
}
