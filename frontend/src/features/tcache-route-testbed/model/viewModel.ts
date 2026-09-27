import { L } from '@/shared/i18n';
export function getTcacheRouteLocationRole(
  index: number,
  total: number,
): string {
  if (index === 0) {
    return L('testbed:jobResultMapComparison.locationSequence.label.departure');
  }
  if (index === total - 1) {
    return L('testbed:jobResultMapComparison.locationSequence.label.arrival');
  }
  return L('testbed:viewModel.getTcacheRouteLocationRole.text.stopover');
}
