import type { ComponentProps } from 'react';
import { LayerBulkActionBar } from '@/features/map-workspace/components/bottom-panel/LayerBulkActionBar';

type Props = ComponentProps<typeof LayerBulkActionBar>;

export function MultiSelectionActionPanel(props: Props) {
  return <LayerBulkActionBar {...props} />;
}
