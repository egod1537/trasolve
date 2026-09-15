import type { ComponentProps } from 'react';
import { LayerBulkActionBar } from './LayerBulkActionBar';

type Props = ComponentProps<typeof LayerBulkActionBar>;

export function MultiSelectionActionPanel(props: Props) {
  return <LayerBulkActionBar {...props} />;
}
